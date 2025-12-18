import { WorkflowContext, WorkflowStep, RecordingSession, RecordedStep, RecordingStepPayload } from '../lib/types';

console.log('Pilot background script loaded');

const globalStore: Record<string, any> = {};
const workflows = new Map<number, WorkflowContext>();

// ============== Recording Session Management ==============
let currentSession: RecordingSession | null = null;

function createRecordingSession(tabId: number, url: string): RecordingSession {
  return {
    id: crypto.randomUUID(),
    name: `Recording ${new Date().toLocaleString()}`,
    startUrl: url,
    startTime: Date.now(),
    steps: [],
    status: 'recording',
    tabId,
  };
}

function addStepToSession(payload: RecordingStepPayload) {
  if (!currentSession || currentSession.status !== 'recording') return;
  
  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...payload,
  };
  
  currentSession.steps.push(step);
  console.log(`[Pilot Recording] Step added:`, step.type, step.element?.tag || step.url);
  
  // 通知 SidePanel 更新
  notifySidePanelUpdate();
}

function addNavigationStep(tabId: number, url: string, title: string) {
  if (!currentSession || currentSession.status !== 'recording') return;
  if (currentSession.tabId !== tabId) return;
  
  // 避免重复记录相同 URL
  const lastStep = currentSession.steps[currentSession.steps.length - 1];
  if (lastStep?.type === 'navigate' && lastStep.url === url) return;
  
  const step: RecordedStep = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: 'navigate',
    url,
    pageTitle: title,
  };
  
  currentSession.steps.push(step);
  console.log(`[Pilot Recording] Navigation step added:`, url);
  
  notifySidePanelUpdate();
}

function notifySidePanelUpdate() {
  chrome.runtime.sendMessage({
    type: 'RECORDING_SESSION_UPDATE',
    payload: currentSession,
  }).catch(() => {});
}

async function startRecording(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  
  currentSession = createRecordingSession(tabId, tab.url || '');
  
  // 添加初始导航步骤
  addNavigationStep(tabId, tab.url || '', tab.title || '');
  
  // 通知 Content Script 开始录制
  await chrome.tabs.sendMessage(tabId, {
    type: 'RECORDING_CONTROL',
    action: 'start',
  });
  
  console.log(`[Pilot Recording] Started for tab ${tabId}`);
  notifySidePanelUpdate();
}

async function stopRecording() {
  if (!currentSession) return;
  
  const tabId = currentSession.tabId;
  currentSession.status = 'stopped';
  
  // 通知 Content Script 停止录制
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'RECORDING_CONTROL',
      action: 'stop',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }
  
  console.log(`[Pilot Recording] Stopped. Total steps: ${currentSession.steps.length}`);
  notifySidePanelUpdate();
}

async function pauseRecording() {
  if (!currentSession) return;
  
  currentSession.status = 'paused';
  
  try {
    await chrome.tabs.sendMessage(currentSession.tabId, {
      type: 'RECORDING_CONTROL',
      action: 'pause',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }
  
  console.log(`[Pilot Recording] Paused`);
  notifySidePanelUpdate();
}

async function resumeRecording() {
  if (!currentSession) return;
  
  currentSession.status = 'recording';
  
  try {
    await chrome.tabs.sendMessage(currentSession.tabId, {
      type: 'RECORDING_CONTROL',
      action: 'start',
    });
  } catch (e) {
    console.warn('[Pilot Recording] Could not notify content script:', e);
  }
  
  console.log(`[Pilot Recording] Resumed`);
  notifySidePanelUpdate();
}

function deleteStep(stepId: string) {
  if (!currentSession) return;
  
  currentSession.steps = currentSession.steps.filter(s => s.id !== stepId);
  console.log(`[Pilot Recording] Step deleted: ${stepId}`);
  notifySidePanelUpdate();
}

function clearRecording() {
  if (currentSession) {
    stopRecording();
  }
  currentSession = null;
  console.log(`[Pilot Recording] Cleared`);
  notifySidePanelUpdate();
}

// ============== Navigation Tracking ==============
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // 只处理主 frame
  
  if (currentSession && currentSession.status === 'recording' && currentSession.tabId === details.tabId) {
    chrome.tabs.get(details.tabId).then(tab => {
      addNavigationStep(details.tabId, details.url, tab.title || '');
    });
  }
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  
  if (currentSession && currentSession.status === 'recording' && currentSession.tabId === details.tabId) {
    chrome.tabs.get(details.tabId).then(tab => {
      addNavigationStep(details.tabId, details.url, tab.title || '');
    });
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
    const { tabId } = request.payload;
    startRecording(tabId).then(() => sendResponse({ success: true, session: currentSession }));
    return true;
  } else if (request.type === 'RECORDING_STOP') {
    stopRecording();
    sendResponse({ success: true, session: currentSession });
  } else if (request.type === 'RECORDING_PAUSE') {
    pauseRecording();
    sendResponse({ success: true, session: currentSession });
  } else if (request.type === 'RECORDING_RESUME') {
    resumeRecording().then(() => sendResponse({ success: true, session: currentSession }));
    return true;
  } else if (request.type === 'RECORDING_GET_SESSION') {
    sendResponse({ session: currentSession });
  } else if (request.type === 'RECORDING_DELETE_STEP') {
    deleteStep(request.payload.stepId);
    sendResponse({ success: true, session: currentSession });
  } else if (request.type === 'RECORDING_CLEAR') {
    clearRecording();
    sendResponse({ success: true });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const workflow = workflows.get(tabId);
  if (workflow && workflow.status === 'running') {
    if (changeInfo.status === 'complete') {
      console.log(`[Pilot Engine] Tab ${tabId} loaded. Executing step...`);
      executeCurrentStep(tabId);
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
          
          // 2. 使用 eval 直接执行（绕过 CSP）
          try {
            console.log('[Pilot Script] Starting execution...');
            eval(injectedCode);
          } catch (e) {
            console.error('[Pilot Script] Execution Error:', e);
            // 通知 Background 失败
            const errorMsg = e instanceof Error ? e.message : String(e);
            if ((window as any).Pilot?.workflow?.fail) {
              (window as any).Pilot.workflow.fail(errorMsg);
            }
          }
          
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
