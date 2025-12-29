import { WorkflowContext, WorkflowStep, RecordingSession, RecordedStep, RecordingStepPayload, ReadyEvent, ReadyEventType } from '../lib/types';

console.log('Pilot background script loaded');

// ============== Page Injection Utilities ==============
function isInjectablePage(url: string | undefined): boolean {
  if (!url) return false;
  const blockedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
  ];
  return !blockedPrefixes.some(prefix => url.startsWith(prefix));
}

async function ensureContentScriptReady(tabId: number): Promise<void> {
  // 尝试 ping content script，检查是否已注入
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    console.log('[Pilot Engine] Content script already active');
    return;
  } catch {
    // Content script 未响应，需要刷新页面让 manifest 自动注入
    // 注意：不使用 chrome.scripting.executeScript 手动注入，因为构建后的文件名带 hash
    console.log('[Pilot Engine] Content script not active, reloading page...');
    await chrome.tabs.reload(tabId);
  }
}

const globalStore: Record<string, any> = {};
const workflows = new Map<number, WorkflowContext>();

// ============== Step Completion System ==============
interface StepCompletionResolver {
  resolve: (type: 'signal' | 'navigation') => void;
  reject: (reason: string) => void;
  cleanup: () => void;
  executingStepIndex: number;
}

const stepCompletionResolvers = new Map<number, StepCompletionResolver>();

function waitForStepCompletion(tabId: number, executingUrl: string, executingStepIndex: number): Promise<'signal' | 'navigation'> {
  // 清理旧的 resolver
  const existing = stepCompletionResolvers.get(tabId);
  if (existing) {
    existing.cleanup();
    existing.reject('Cancelled by new step execution');
  }

  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const safeResolve = (type: 'signal' | 'navigation') => {
      if (!resolved) {
        resolved = true;
        resolve(type);
      }
    };
    
    // 监听 URL 变化（MPA 导航场景）
    const urlChangeListener = (tabIdChanged: number, changeInfo: any) => {
      if (tabIdChanged === tabId && changeInfo.url && changeInfo.url !== executingUrl) {
        console.log(`[Pilot Engine] URL changed detected: ${executingUrl} -> ${changeInfo.url}`);
        safeResolve('navigation');
      }
    };
    
    chrome.tabs.onUpdated.addListener(urlChangeListener);
    
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(urlChangeListener);
      stepCompletionResolvers.delete(tabId);
    };
    
    stepCompletionResolvers.set(tabId, {
      resolve: safeResolve,
      reject,
      cleanup,
      executingStepIndex
    });
    
    console.log(`[Pilot Engine] Waiting for step completion: signal or navigation`);
  });
}

// ============== Ready Event System ==============
interface ReadyResolver {
  resolve: () => void;
  reject: (reason: string) => void;
  requiredEvents: Set<ReadyEventType>;
  receivedEvents: Set<ReadyEventType>;
  timeout?: ReturnType<typeof setTimeout>;
}

const readyResolvers = new Map<number, ReadyResolver>();

// 注意：webNavigation.onCommitted 监听器在 Navigation Tracking 部分（第 305 行附近）

function waitForPageReady(tabId: number, requiredEvents: ReadyEventType[] = ['PAGE_FULLY_READY'], timeoutMs: number = 10000): Promise<void> {
  // 如果已有等待中的 resolver，先清理它
  const existingResolver = readyResolvers.get(tabId);
  if (existingResolver) {
    if (existingResolver.timeout) clearTimeout(existingResolver.timeout);
    existingResolver.reject('Cancelled by new ready wait request');
    readyResolvers.delete(tabId);
  }

  return new Promise((resolve, reject) => {
    const resolver: ReadyResolver = {
      resolve,
      reject,
      requiredEvents: new Set(requiredEvents),
      receivedEvents: new Set(),
      timeout: setTimeout(() => {
        readyResolvers.delete(tabId);
        const msg = `Page ready timeout (${timeoutMs}ms) for tab ${tabId}. Required: ${requiredEvents.join(', ')}`;
        console.error(`[Pilot Engine] ${msg}`);
        reject(msg);
      }, timeoutMs)
    };

    readyResolvers.set(tabId, resolver);
    console.log(`[Pilot Engine] Waiting for page ready in Tab ${tabId}:`, requiredEvents);
  });
}

function handleReadyEvent(event: ReadyEvent) {
  const { tabId, type } = event;
  console.log(`[Pilot Engine] Ready event received: ${type} for Tab ${tabId}`);

  const resolver = readyResolvers.get(tabId);
  if (!resolver) {
    console.log(`[Pilot Engine] No resolver found for Tab ${tabId}, ignoring event`);
    return;
  }

  resolver.receivedEvents.add(type);
  console.log(`[Pilot Engine] Tab ${tabId} - required: [${Array.from(resolver.requiredEvents)}], received: [${Array.from(resolver.receivedEvents)}]`);

  // 检查是否所有必需的事件都已收到
  const allReceived = Array.from(resolver.requiredEvents).every(e => resolver.receivedEvents.has(e));

  if (allReceived) {
    if (resolver.timeout) clearTimeout(resolver.timeout);
    readyResolvers.delete(tabId);
    console.log(`[Pilot Engine] Page fully ready in Tab ${tabId}`);
    resolver.resolve();
  }
}

// ============== Recording Session Management ==============
let sessions: Record<string, RecordingSession> = {}; // scriptId -> RecordingSession
let activeScriptId: string | null = null;

// 从存储中恢复所有会话
let isRestoring = true;
chrome.storage.local.get(['recordingSessions', 'activeScriptId']).then(res => {
  console.log('[Pilot BG] Restoring sessions from storage, raw data:', res);
  if (res.recordingSessions && typeof res.recordingSessions === 'object') {
    sessions = res.recordingSessions as Record<string, RecordingSession>;
    console.log('[Pilot BG] Sessions restored:', Object.keys(sessions));
    Object.entries(sessions).forEach(([id, session]) => {
      console.log(`[Pilot BG] Session ${id}: ${session.steps?.length || 0} steps`);
    });
  } else {
    console.log('[Pilot BG] No sessions found in storage');
  }
  if (res.activeScriptId && typeof res.activeScriptId === 'string') {
    activeScriptId = res.activeScriptId as string;
    console.log('[Pilot BG] Active script restored:', activeScriptId);
  }
  isRestoring = false;
});

function saveSessionsToStorage() {
  chrome.storage.local.set({ recordingSessions: sessions, activeScriptId }).then(() => {
    console.log('[Pilot BG] Sessions saved to storage:', Object.keys(sessions), 'activeScriptId:', activeScriptId);
  }).catch(err => {
    console.error('[Pilot BG] Failed to save sessions:', err);
  });
}

function createRecordingSession(tabId: number, url: string, scriptId: string): RecordingSession {
  const session: RecordingSession = {
    id: crypto.randomUUID(),
    scriptId,
    name: `Recording ${new Date().toLocaleString()}`,
    startUrl: url,
    startTime: Date.now(),
    steps: [],
    status: 'recording',
    tabId,
  };
  return session;
}

function addStepToSession(payload: RecordingStepPayload) {
  if (!activeScriptId || !sessions[activeScriptId] || sessions[activeScriptId].status !== 'recording') return;

  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...payload,
  };

  sessions[activeScriptId].steps.push(step);
  console.log(`[Pilot Recording] Step added to script ${activeScriptId}:`, step.type);

  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

function addNavigationStep(tabId: number, url: string, title: string) {
  if (!activeScriptId || !sessions[activeScriptId] || sessions[activeScriptId].status !== 'recording') return;
  if (sessions[activeScriptId].tabId !== tabId) return;

  const session = sessions[activeScriptId];
  // 避免重复记录相同 URL
  const lastStep = session.steps[session.steps.length - 1];
  if (lastStep?.type === 'navigate' && lastStep.url === url) return;

  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'navigate',
    url,
    pageTitle: title,
  };

  session.steps.push(step);
  console.log(`[Pilot Recording] Navigation step added to script ${activeScriptId}:`, url);

  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

function notifySidePanelUpdate(scriptId: string) {
  chrome.runtime.sendMessage({
    type: 'RECORDING_SESSION_UPDATE',
    payload: sessions[scriptId],
    scriptId
  }).catch(() => { });
}

async function startRecording(tabId: number, scriptId: string) {
  const tab = await chrome.tabs.get(tabId);

  activeScriptId = scriptId;
  sessions[scriptId] = createRecordingSession(tabId, tab.url || '', scriptId);

  // 添加初始导航步骤
  addNavigationStep(tabId, tab.url || '', tab.title || '');

  // 通知 Content Script 开始录制
  await chrome.tabs.sendMessage(tabId, {
    type: 'RECORDING_CONTROL',
    action: 'start',
  });

  console.log(`[Pilot Recording] Started for script ${scriptId} in tab ${tabId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(scriptId);
}

async function stopRecording() {
  if (!activeScriptId || !sessions[activeScriptId]) return;

  const session = sessions[activeScriptId];
  const tabId = session.tabId;
  session.status = 'stopped';

  // 通知 Content Script 停止录制
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'RECORDING_CONTROL',
      action: 'stop',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }

  console.log(`[Pilot Recording] Stopped for script ${activeScriptId}. Total steps: ${session.steps.length}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
  activeScriptId = null; // 停止后不再是活跃录制状态
  saveSessionsToStorage();
}

async function pauseRecording() {
  if (!activeScriptId || !sessions[activeScriptId]) return;

  const session = sessions[activeScriptId];
  session.status = 'paused';

  try {
    await chrome.tabs.sendMessage(session.tabId, {
      type: 'RECORDING_CONTROL',
      action: 'pause',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }

  console.log(`[Pilot Recording] Paused for script ${activeScriptId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

async function resumeRecording() {
  if (!activeScriptId || !sessions[activeScriptId]) return;

  const session = sessions[activeScriptId];
  session.status = 'recording';

  try {
    await chrome.tabs.sendMessage(session.tabId, {
      type: 'RECORDING_CONTROL',
      action: 'start',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }

  console.log(`[Pilot Recording] Resumed for script ${activeScriptId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(activeScriptId);
}

function deleteStep(scriptId: string, stepId: string) {
  if (!sessions[scriptId]) return;

  sessions[scriptId].steps = sessions[scriptId].steps.filter(s => s.id !== stepId);
  console.log(`[Pilot Recording] Step deleted from script ${scriptId}: ${stepId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(scriptId);
}

function updateStep(scriptId: string, stepId: string, updates: Partial<RecordedStep>) {
  if (!sessions[scriptId]) return;

  const stepIdx = sessions[scriptId].steps.findIndex(s => s.id === stepId);
  if (stepIdx === -1) return;

  sessions[scriptId].steps[stepIdx] = {
    ...sessions[scriptId].steps[stepIdx],
    ...updates,
    timestamp: Date.now(), // 更新时间戳
  };

  console.log(`[Pilot Recording] Step updated in script ${scriptId}: ${stepId}`);
  saveSessionsToStorage();
  notifySidePanelUpdate(scriptId);
}

function addAiStep(scriptId: string, instruction: string) {
  if (!sessions[scriptId] || sessions[scriptId].status !== 'recording') return;

  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'ai_step',
    url: '', // 会在生成脚本时处理，或者根据当前活跃 Tab 填充
    pageTitle: 'AI Step',
    value: instruction
  };

  // 尽量填充当前 URL
  chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    if (tabs[0]) {
      step.url = tabs[0].url || '';
      step.pageTitle = tabs[0].title || 'AI Step';
    }
    sessions[scriptId].steps.push(step);
    saveSessionsToStorage();
    notifySidePanelUpdate(scriptId);
  });
}

function clearRecording(scriptId: string) {
  if (activeScriptId === scriptId) {
    stopRecording();
  }
  delete sessions[scriptId];
  console.log(`[Pilot Recording] Cleared for script ${scriptId}`);
  saveSessionsToStorage();
  // 注意：不需要调用 notifySidePanelUpdate，因为会话已被删除
}

// ============== Navigation Tracking (Enhanced) ==============

// 监听导航开始事件（比 onCompleted 更早）
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // 只处理主 frame

  const tabId = details.tabId;
  const workflow = workflows.get(tabId);

  // 1. 工作流导航监控（仅日志）
  if (workflow && workflow.status === 'running') {
    console.log(`[Pilot Engine] Navigation detected in Tab ${tabId}: ${details.url}`);
  }

  // 2. 录制导航监控
  if (activeScriptId && sessions[activeScriptId]?.status === 'recording' && sessions[activeScriptId].tabId === tabId) {
    chrome.tabs.get(tabId).then(tab => {
      addNavigationStep(tabId, details.url, tab.title || '');

      // 确保内容脚本开始录制
      chrome.tabs.sendMessage(tabId, {
        type: 'RECORDING_CONTROL',
        action: 'start',
      }).catch(() => { });
    });
  }
});

// 监听 History State 更新（SPA 内导航）
// 监听 History State 更新（SPA 内导航）
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;

  const tabId = details.tabId;

  // 1. 工作流导航监控（仅日志）
  const workflow = workflows.get(tabId);
  if (workflow && workflow.status === 'running') {
    console.log(`[Pilot Engine] History state updated in Tab ${tabId}: ${details.url}`);
  }

  // 2. 录制导航监控
  if (activeScriptId && sessions[activeScriptId]?.status === 'recording' && sessions[activeScriptId].tabId === tabId) {
    chrome.tabs.get(tabId).then(tab => {
      addNavigationStep(tabId, details.url, tab.title || '');
    });
  }
});

// 处理新打开的标签页（如果正在录制且是从录制页打开的）
chrome.tabs.onCreated.addListener((tab) => {
  if (activeScriptId && sessions[activeScriptId]?.status === 'recording') {
    const session = sessions[activeScriptId];
    // 如果新标签页有 openerTabId 且等于当前录制的标签页
    if (tab.openerTabId === session.tabId) {
      console.log(`[Pilot Recording] Following recording to new tab: ${tab.id}`);
      session.tabId = tab.id!;
      notifySidePanelUpdate(activeScriptId);
    }
  }
});

// ============== Message Handling ==============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Pilot BG] Received message:', request.type);

  // 处理就绪事件
  if (request.type && ['CONTENT_SCRIPT_READY', 'PAGE_AGENT_READY', 'PAGE_FULLY_READY'].includes(request.type)) {
    const tabId = sender.tab?.id;
    if (tabId) {
      // 在 content script 就绪时注入 main-world script
      if (request.type === 'CONTENT_SCRIPT_READY') {
        console.log(`[Pilot] Content script ready in tab ${tabId}, injecting main-world script`);
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['main-world.js'],
          world: 'MAIN',
        }).then(() => {
          console.log(`[Pilot] Main world script injected successfully in tab ${tabId}`);
        }).catch((error) => {
          console.error(`[Pilot] Failed to inject main world script in tab ${tabId}:`, error);
        });
      }
      
      handleReadyEvent({
        type: request.type as ReadyEventType,
        tabId,
        timestamp: Date.now()
      });
    }
    sendResponse({ success: true });
    return;
  }

  if (request.type === 'PILOT_BRIDGE_ACTION') {
    handleBridgeAction(request.action, request.payload, sender);
  } else if (request.type === 'START_WORKFLOW') {
    const { steps, tabId } = request.payload;
    
    // 异步处理：智能处理页面状态，确保 content script 就绪后再开始 workflow
    (async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        const currentUrl = tab.url;
        
        if (!isInjectablePage(currentUrl)) {
          // 当前页面不可注入（chrome://, about: 等）
          const firstStepUrl = steps[0]?.url;
          
          if (firstStepUrl && isInjectablePage(firstStepUrl)) {
            console.log(`[Pilot Engine] Current page not injectable, navigating to: ${firstStepUrl}`);
            await chrome.tabs.update(tabId, { url: firstStepUrl });
            await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
          } else {
            throw new Error('当前页面无法执行脚本，请先打开目标网页');
          }
        } else {
          // 可注入页面：确保 content script 就绪（注入或刷新）
          await ensureContentScriptReady(tabId);
          chrome.tabs.sendMessage(tabId, { type: 'RESET_AGENT' }).catch(() => {});
          console.log(`[Pilot Engine] Waiting for page ready before starting workflow...`);
          await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
        }
        
        console.log(`[Pilot Engine] Page ready, starting workflow`);
        startWorkflow(steps, tabId);
      } catch (err) {
        console.error('[Pilot Engine] Failed to prepare workflow:', err);
        const errorMsg = `准备执行失败: ${err instanceof Error ? err.message : String(err)}`;
        notifyWorkflowStatus(tabId, 'failed', errorMsg);
      }
    })();
  } else if (request.type === 'RECORDING_STEP') {
    addStepToSession(request.payload);
  } else if (request.type === 'RECORDING_START') {
    const { tabId, scriptId } = request.payload;
    startRecording(tabId, scriptId).then(() => sendResponse({ success: true, session: sessions[scriptId] }));
    return true;
  } else if (request.type === 'RECORDING_STOP') {
    const sId = activeScriptId;
    stopRecording().then(() => {
      sendResponse({ success: true, session: sId ? sessions[sId] : null });
    });
    return true;
  } else if (request.type === 'RECORDING_PAUSE') {
    const sId = activeScriptId;
    pauseRecording().then(() => sendResponse({ success: true, session: sId ? sessions[sId] : null }));
    return true;
  } else if (request.type === 'RECORDING_RESUME') {
    const sId = activeScriptId;
    resumeRecording().then(() => sendResponse({ success: true, session: sId ? sessions[sId] : null }));
    return true;
  } else if (request.type === 'RECORDING_GET_SESSION') {
    const { scriptId } = request.payload || {};
    console.log('[Pilot BG] RECORDING_GET_SESSION for scriptId:', scriptId, 'isRestoring:', isRestoring);
    console.log('[Pilot BG] Current sessions keys:', Object.keys(sessions));
    
    if (!scriptId) {
      sendResponse({ session: null });
      return;
    }

    const sendRes = () => {
      const session = sessions[scriptId] || null;
      console.log('[Pilot BG] Returning session for', scriptId, ':', session ? `${session.steps?.length} steps` : 'null');
      sendResponse({ session });
    };

    if (isRestoring) {
      console.log('[Pilot BG] Still restoring, fetching from storage...');
      chrome.storage.local.get(['recordingSessions']).then(res => {
        if (res.recordingSessions && typeof res.recordingSessions === 'object') {
          sessions = res.recordingSessions as Record<string, RecordingSession>;
        }
        isRestoring = false;
        sendRes();
      });
      return true;
    } else {
      sendRes();
    }
  } else if (request.type === 'RECORDING_DELETE_STEP') {
    const { scriptId, stepId } = request.payload;
    deleteStep(scriptId, stepId);
    sendResponse({ success: true, session: sessions[scriptId] });
  } else if (request.type === 'RECORDING_UPDATE_STEP') {
    const { scriptId, stepId, updates } = request.payload;
    updateStep(scriptId, stepId, updates);
    sendResponse({ success: true, session: sessions[scriptId] });
  } else if (request.type === 'RECORDING_ADD_AI_STEP') {
    const { scriptId, instruction } = request.payload;
    addAiStep(scriptId, instruction);
    // 因为 addAiStep 是异步的（需要查询 tabs），所以我们在这里直接返回，让 notifySidePanelUpdate 处理更新
    sendResponse({ success: true, session: sessions[scriptId] });
  } else if (request.type === 'RECORDING_CLEAR') {
    const { scriptId } = request.payload;
    clearRecording(scriptId);
    sendResponse({ success: true });
  } else if (request.type === 'RECORDING_GET_STATUS') {
    const checkStatus = () => {
      sendResponse({
        isRecording: activeScriptId !== null && sessions[activeScriptId]?.status === 'recording',
        activeScriptId,
        session: activeScriptId ? sessions[activeScriptId] : null
      });
    };

    if (isRestoring) {
      chrome.storage.local.get(['recordingSessions', 'activeScriptId']).then(res => {
        if (res.recordingSessions && typeof res.recordingSessions === 'object') {
          sessions = res.recordingSessions as Record<string, RecordingSession>;
        }
        if (res.activeScriptId && typeof res.activeScriptId === 'string') {
          activeScriptId = res.activeScriptId as string;
        }
        isRestoring = false;
        checkStatus();
      });
      return true;
    } else {
      checkStatus();
    }
  }
});

function handleBridgeAction(action: string, payload: any, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (!tabId) {
    console.log('[Pilot BG] No tabId in sender');
    return;
  }

  console.log(`[Pilot BG] Bridge Action [Tab ${tabId}]:`, action, payload);

  switch (action) {
    case 'openTab':
      chrome.tabs.create({ url: payload.url });
      break;
    case 'setData':
      globalStore[payload.key] = payload.value;
      break;
    case 'workflowNext':
      const workflow = workflows.get(tabId);
      if (workflow && workflow.status === 'running') {
        if (payload.data) {
          workflow.data = { ...workflow.data, ...payload.data };
        }
        console.log(`[Pilot Engine] Step finished in Tab ${tabId}. Data:`, workflow.data);
        
        // 通知 waitForStepCompletion
        const resolver = stepCompletionResolvers.get(tabId);
        if (resolver) {
          resolver.resolve('signal');
          resolver.cleanup();
        }
        
        // 推进到下一步
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] No running workflow for Tab ${tabId}`);
      }
      break;
    case 'workflowFinish':
      const wf = workflows.get(tabId);
      if (wf) {
        // 通知 waitForStepCompletion
        const resolver = stepCompletionResolvers.get(tabId);
        if (resolver) {
          resolver.resolve('signal');
          resolver.cleanup();
        }
        
        wf.status = 'completed';
        workflows.delete(tabId);
        console.log(`[Pilot Engine] Workflow finished manually in Tab ${tabId}.`);
        
        // 通知 sidepanel
        notifyWorkflowStatus(tabId, 'completed');
      }
      break;
    case 'workflowFail':
      const failedWf = workflows.get(tabId);
      if (failedWf) {
        // 清理 step completion resolver
        const resolver = stepCompletionResolvers.get(tabId);
        if (resolver) {
          resolver.cleanup();
          stepCompletionResolvers.delete(tabId);
        }
        
        failedWf.status = 'failed';
        const stepName = failedWf.steps[failedWf.currentStepIndex]?.name || 'Unknown';
        const errorMsg = `步骤 "${stepName}" 失败: ${payload.reason}`;
        workflows.delete(tabId);
        console.error(`[Pilot Engine] ❌ Workflow FAILED at Step "${stepName}": ${payload.reason}`);
        
        // 通知 sidepanel
        notifyWorkflowStatus(tabId, 'failed', errorMsg);
        
        // Notify user via alert in the tab
        chrome.scripting.executeScript({
          target: { tabId },
          func: (reason: string, step: string) => {
            alert(`Pilot Workflow 失败！\n\n步骤: ${step}\n原因: ${reason}`);
          },
          args: [payload.reason, stepName]
        });
      }
      break;
  }
}

function notifyWorkflowStatus(tabId: number, status: 'completed' | 'failed', error?: string) {
  chrome.runtime.sendMessage({
    type: 'WORKFLOW_STATUS_UPDATE',
    payload: { tabId, status, error }
  }).catch(() => {});
}

async function startWorkflow(steps: WorkflowStep[], tabId: number) {
  console.log(`[Pilot Engine] Starting workflow in Tab ${tabId} with ${steps.length} steps`);

  const workflow: WorkflowContext = {
    currentStepIndex: 0,
    data: {},
    steps,
    tabId,
    status: 'running'
  };

  workflows.set(tabId, workflow);

  // 直接执行第一步，executeCurrentStep 会处理导航和就绪
  executeCurrentStep(tabId);
}

async function executeCurrentStep(tabId: number) {
  const workflow = workflows.get(tabId);
  if (!workflow) {
    console.log(`[Pilot Engine] No workflow found for Tab ${tabId}`);
    return;
  }

  const { steps, currentStepIndex } = workflow;

  if (currentStepIndex >= steps.length) {
    console.log(`[Pilot Engine] All steps completed for Tab ${tabId}.`);
    workflow.status = 'completed';
    workflows.delete(tabId);
    notifyWorkflowStatus(tabId, 'completed');
    return;
  }

  const step = steps[currentStepIndex];
  console.log(`[Pilot Engine] Executing Step ${currentStepIndex + 1}: ${step.name}`);

  try {
    // ===== Phase 1: 导航（如果需要）=====
    // 注意：workflow 开始前已经确保页面就绪，所以只有导航时才需要等待
    if (step.url) {
      const currentTab = await chrome.tabs.get(tabId);
      if (currentTab.url !== step.url) {
        console.log(`[Pilot Engine] Navigating to: ${step.url}`);
        await chrome.tabs.update(tabId, { url: step.url });

        // 导航后等待新页面就绪
        console.log(`[Pilot Engine] Waiting for new page to be ready...`);
        await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
        console.log(`[Pilot Engine] New page ready`);
      }
    }
    // 如果不需要导航，页面在 workflow 开始前已经就绪，直接执行

    // ===== Phase 2: 记录执行前 URL =====
    const beforeExecuteTab = await chrome.tabs.get(tabId);
    workflow.executingUrl = beforeExecuteTab.url;
    console.log(`[Pilot Engine] Page ready. Current URL: ${workflow.executingUrl}`);

    // ===== Phase 3: 脚本安全检查 =====
    const data = workflow.data;
    const code = step.code;

    console.log(`[Pilot Engine] 📜 Code:\n${code.slice(0, 200)}...`);

    // 防御性检查：拦截非法选择器
    const illegalSelectorPatterns = [
      /:has-text\(/i,
      /:contains\(/i,
      /:text\(/i,
      />>.*["']/,
    ];

    for (const pattern of illegalSelectorPatterns) {
      if (pattern.test(code)) {
        const match = code.match(pattern);
        console.error(`[Pilot Engine] 🛡️ 检测到非法选择器: ${match?.[0]}`);
        const errorMsg = `脚本包含非法选择器: "${match?.[0] || '未知'}"\n\n浏览器 querySelector 不支持 Playwright/Cypress 伪类。\n请使用标准选择器：id、name、aria-label、role、语义标签+属性。\n\n示例：\n❌ button:has-text("分享")\n✅ button[aria-label="分享"]\n✅ #share-btn\n✅ [data-action="share"]`;

        await chrome.scripting.executeScript({
          target: { tabId },
          func: (msg: string) => alert(msg),
          args: [errorMsg]
        });

        workflow.status = 'failed';
        workflows.delete(tabId);
        return;
      }
    }

    console.log(`[Pilot Engine] ✅ 安全检查通过，开始执行...`);

    // ===== Phase 4: 执行脚本 =====
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (injectedData: Record<string, any>, injectedCode: string) => {
        console.log('[Pilot] Executing script in Main World...');

        // 注入数据到全局
        (window as any).PilotData = injectedData;

        // 直接执行（不再监听 beforeunload）
        try {
          console.log('[Pilot Script] Starting execution...');
          eval(injectedCode);
        } catch (e) {
          console.error('[Pilot Script] Execution Error:', e);
          const errorMsg = e instanceof Error ? e.message : String(e);
          if ((window as any).Pilot?.workflow?.fail) {
            (window as any).Pilot.workflow.fail(errorMsg);
          }
        }

        console.log('[Pilot] Script execution initiated');
      },
      args: [data, code],
      world: 'MAIN'
    });

    console.log(`[Pilot Engine] Script injected into Tab ${tabId}`);

    // ===== Phase 5: 等待步骤完成（事件驱动，无超时） =====
    const executingStepIndex = currentStepIndex;
    const executingUrl = workflow.executingUrl!;
    
    console.log(`[Pilot Engine] Waiting for step completion...`);
    
    const completionType = await waitForStepCompletion(tabId, executingUrl, executingStepIndex);
    
    if (completionType === 'navigation') {
      // MPA 导航：等待新页面就绪后推进
      console.log(`[Pilot Engine] Navigation detected, waiting for new page ready...`);
      await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
      console.log(`[Pilot Engine] New page ready, auto-advancing workflow`);
      
      // 再次检查工作流是否已被推进（防止重复推进）
      const latestWorkflow = workflows.get(tabId);
      if (latestWorkflow && latestWorkflow.currentStepIndex === executingStepIndex) {
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] Workflow already advanced by signal, skipping navigation-based advance`);
      }
    } else {
      // 'signal': workflow.next/finish 已经调用了 advanceWorkflow，无需额外操作
      console.log(`[Pilot Engine] Step completed by signal`);
    }

  } catch (err: any) {
    console.error('[Pilot Engine] Execution failed:', err);
    const errorMsg = err.message || String(err);
    workflow.status = 'failed';
    workflows.delete(tabId);
    
    // 通知 sidepanel
    notifyWorkflowStatus(tabId, 'failed', errorMsg);

    // 通知用户
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (msg: string) => alert(`Pilot 执行失败：\n${msg}`),
        args: [errorMsg]
      });
    } catch (e) {
      console.error('[Pilot Engine] Failed to show error alert:', e);
    }
  }
}

function advanceWorkflow(tabId: number) {
  const workflow = workflows.get(tabId);
  if (!workflow) return;

  workflow.currentStepIndex++;
  const { steps, currentStepIndex } = workflow;

  if (currentStepIndex >= steps.length) {
    console.log(`[Pilot Engine] Workflow Completed in Tab ${tabId}! 🚀`);
    workflow.status = 'completed';
    workflows.delete(tabId);
    notifyWorkflowStatus(tabId, 'completed');
    return;
  }

  const nextStep = steps[currentStepIndex];
  console.log(`[Pilot Engine] Advancing to Step ${currentStepIndex + 1}: ${nextStep.name}`);

  // 直接调用 executeCurrentStep，它会处理导航和就绪等待
  executeCurrentStep(tabId);
}
