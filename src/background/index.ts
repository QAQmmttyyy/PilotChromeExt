import { WorkflowContext, WorkflowStep, RecordingSession, RecordedStep, RecordingStepPayload } from '../lib/types';

console.log('Pilot background script loaded');

const globalStore: Record<string, any> = {};
const workflows = new Map<number, WorkflowContext>();

// ============== Recording Session Management ==============
let sessions: Record<string, RecordingSession> = {}; // scriptId -> RecordingSession
let activeScriptId: string | null = null;

// 从存储中恢复所有会话
let isRestoring = true;
chrome.storage.local.get(['recordingSessions', 'activeScriptId']).then(res => {
  if (res.recordingSessions && typeof res.recordingSessions === 'object') {
    sessions = res.recordingSessions as Record<string, RecordingSession>;
    console.log('[Pilot BG] Sessions restored from storage');
  }
  if (res.activeScriptId && typeof res.activeScriptId === 'string') {
    activeScriptId = res.activeScriptId as string;
  }
  isRestoring = false;
});

function saveSessionsToStorage() {
  chrome.storage.local.set({ recordingSessions: sessions, activeScriptId });
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
  }).catch(() => {});
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

function clearRecording(scriptId: string) {
  if (activeScriptId === scriptId) {
    stopRecording();
  }
  delete sessions[scriptId];
  console.log(`[Pilot Recording] Cleared for script ${scriptId}`);
  saveSessionsToStorage();
  // 注意：不需要调用 notifySidePanelUpdate，因为会话已被删除
}

// ============== Navigation Tracking ==============
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // 只处理主 frame
  
  if (activeScriptId && sessions[activeScriptId]?.status === 'recording' && sessions[activeScriptId].tabId === details.tabId) {
    chrome.tabs.get(details.tabId).then(tab => {
      addNavigationStep(details.tabId, details.url, tab.title || '');
      
      // 确保内容脚本开始录制
      chrome.tabs.sendMessage(details.tabId, {
        type: 'RECORDING_CONTROL',
        action: 'start',
      }).catch(() => {
        // 脚本可能还没准备好，没关系，脚本加载时会主动问 status
      });
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  
  if (activeScriptId && sessions[activeScriptId]?.status === 'recording' && sessions[activeScriptId].tabId === details.tabId) {
    chrome.tabs.get(details.tabId).then(tab => {
      addNavigationStep(details.tabId, details.url, tab.title || '');
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
  
  if (request.type === 'PILOT_BRIDGE_ACTION') {
    handleBridgeAction(request.action, request.payload, sender);
  } else if (request.type === 'START_WORKFLOW') {
    const { steps, tabId } = request.payload;
    startWorkflow(steps, tabId);
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
    if (!scriptId) {
      sendResponse({ session: null });
      return;
    }
    
    const sendRes = () => {
      sendResponse({ session: sessions[scriptId] || null });
    };

    if (isRestoring) {
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
  } else if (request.type === 'RECORDING_CLEAR') {
    const { scriptId } = request.payload;
    clearRecording(scriptId);
    sendResponse({ success: true });
  } else if (request.type === 'STEP_NAVIGATING') {
    // 脚本触发了导航，标记状态
    const tabId = sender.tab?.id;
    if (tabId) {
      const workflow = workflows.get(tabId);
      if (workflow && workflow.status === 'running') {
        workflow.stepNavigating = true;
        console.log(`[Pilot Engine] Step triggered navigation in Tab ${tabId}`);
      }
    }
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

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const workflow = workflows.get(tabId);
  if (workflow && workflow.status === 'running') {
    if (changeInfo.status === 'complete') {
      if (workflow.stepNavigating) {
        // 脚本触发的导航，自动推进到下一步
        console.log(`[Pilot Engine] Tab ${tabId} loaded after script navigation. Advancing...`);
        workflow.stepNavigating = false;
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] Tab ${tabId} loaded. Executing step...`);
        executeCurrentStep(tabId);
      }
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
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] No running workflow for Tab ${tabId}`);
      }
      break;
    case 'workflowFinish':
      const wf = workflows.get(tabId);
      if (wf) {
        wf.status = 'completed';
        workflows.delete(tabId);
        console.log(`[Pilot Engine] Workflow finished manually in Tab ${tabId}.`);
      }
      break;
    case 'workflowFail':
      const failedWf = workflows.get(tabId);
      if (failedWf) {
        failedWf.status = 'failed';
        workflows.delete(tabId);
        const stepName = failedWf.steps[failedWf.currentStepIndex]?.name || 'Unknown';
        console.error(`[Pilot Engine] ❌ Workflow FAILED at Step "${stepName}": ${payload.reason}`);
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

  const firstStep = steps[0];
  if (firstStep.url) {
     console.log(`[Pilot Engine] First step requires navigation to: ${firstStep.url}`);
     chrome.tabs.update(tabId, { url: firstStep.url });
  } else {
     console.log(`[Pilot Engine] First step has no URL, executing directly`);
     executeCurrentStep(tabId);
  }
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
    return;
  }

  const step = steps[currentStepIndex];
  console.log(`[Pilot Engine] Executing Step ${currentStepIndex + 1}: ${step.name}`);

  try {
     const data = workflow.data;
     const code = step.code;

     // 🔍 调试：打印 AI 生成的脚本内容
     console.log(`[Pilot Engine] 📜 AI Generated Code:\n${code}`);

     // 🛡️ 防御性检查：拦截非法选择器（运行时保护）
     const illegalSelectorPatterns = [
       /:has-text\(/i,
       /:contains\(/i,
       /:text\(/i,
       />>.*["']/,  // Playwright 的 >> "文本" 语法
     ];
     
     for (const pattern of illegalSelectorPatterns) {
       if (pattern.test(code)) {
         const match = code.match(pattern);
         console.error(`[Pilot Engine] 🛡️ 检测到非法选择器: ${match?.[0]}`);
         const errorMsg = `脚本包含非法选择器: "${match?.[0] || '未知'}"\n\n浏览器 querySelector 不支持 Playwright/Cypress 伪类。\n请使用标准选择器：id、name、aria-label、role、语义标签+属性。\n\n示例：\n❌ button:has-text("分享")\n✅ button[aria-label="分享"]\n✅ #share-btn\n✅ [data-action="share"]`;
         
         // 直接通知用户
         await chrome.scripting.executeScript({
           target: { tabId },
           func: (msg: string) => alert(msg),
           args: [errorMsg]
         });
         
         workflow.status = 'failed';
         workflows.delete(tabId);
         console.error(`[Pilot Engine] 🛡️ 拦截非法选择器: ${match?.[0]}`);
         return;
       }
     }
     
     console.log(`[Pilot Engine] ✅ 选择器检查通过，准备执行脚本...`);

    // 使用 Main World 执行（直接 eval，绕过 CSP 对 <script> 标签的限制）
    // chrome.scripting.executeScript 在 world: 'MAIN' 里可以使用 eval，不受 CSP 约束
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (injectedData: Record<string, any>, injectedCode: string) => {
         console.log('[Pilot] Executing script in Main World (via eval)...');
         
         // 1. 先注入数据到全局
         (window as any).PilotData = injectedData;
         
         // 2. 监听页面卸载，通知 background 脚本触发了导航
         const notifyNavigation = () => {
           // 使用 sendBeacon 确保消息能在页面卸载前发出
           // 但 Chrome extension 不支持 sendBeacon 到 runtime，用 postMessage 替代
           window.postMessage({ 
             source: 'PILOT_SCRIPT', 
             action: 'stepNavigating',
             payload: {} 
           }, '*');
         };
         window.addEventListener('beforeunload', notifyNavigation, { once: true });
         window.addEventListener('pagehide', notifyNavigation, { once: true });
         
         // 3. 使用 eval 直接执行（绕过 CSP）
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
         
         // 4. 清理 PilotData（如果脚本同步完成）
         // 注意：如果脚本触发了导航，这行不会执行
         console.log('[Pilot] Script execution completed');
      },
      args: [data, code],
      world: 'MAIN'
    });
     
     console.log(`[Pilot Engine] Script execution completed for Tab ${tabId}`);

  } catch (err) {
    console.error('[Pilot Engine] Execution failed:', err);
    workflows.delete(tabId);
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
    return;
  }

  const nextStep = steps[currentStepIndex];
  if (nextStep.url) {
    console.log(`[Pilot Engine] Step ${currentStepIndex + 1} requires navigation to: ${nextStep.url}`);
    chrome.tabs.update(tabId, { url: nextStep.url });
  } else {
    executeCurrentStep(tabId);
  }
}
