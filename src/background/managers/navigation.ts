import * as recordingManager from './recording';
import * as workflowManager from './workflow';

// ============== Navigation Tracking (Enhanced) ==============

export function setupNavigationListeners() {
  // 监听导航开始事件（比 onCompleted 更早）
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return; // 只处理主 frame

    const tabId = details.tabId;
    const workflow = workflowManager.getWorkflow(tabId);

    // 1. 工作流导航监控（仅日志）
    if (workflow && workflow.status === 'running') {
      console.log(`[Pilot Engine] Navigation detected in Tab ${tabId}: ${details.url}`);
    }

    // 2. 录制导航监控
    const activeScriptId = recordingManager.getActiveScriptId();
    const session = activeScriptId ? recordingManager.getSession(activeScriptId) : null;

    if (activeScriptId && session?.status === 'recording' && session.tabId === tabId) {
      chrome.tabs.get(tabId).then(tab => {
        recordingManager.addNavigationStep(tabId, details.url, tab.title || '');

        // 确保内容脚本开始录制
        chrome.tabs.sendMessage(tabId, {
          type: 'RECORDING_CONTROL',
          action: 'start',
        }).catch(() => { });
      });
    }
  });

  // 监听 History State 更新（SPA 内导航）
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;

    const tabId = details.tabId;

    // 1. 工作流导航监控（仅日志）
    const workflow = workflowManager.getWorkflow(tabId);
    if (workflow && workflow.status === 'running') {
      console.log(`[Pilot Engine] History state updated in Tab ${tabId}: ${details.url}`);
    }

    // 2. 录制导航监控
    const activeScriptId = recordingManager.getActiveScriptId();
    const session = activeScriptId ? recordingManager.getSession(activeScriptId) : null;

    if (activeScriptId && session?.status === 'recording' && session.tabId === tabId) {
      chrome.tabs.get(tabId).then(tab => {
        recordingManager.addNavigationStep(tabId, details.url, tab.title || '');
      });
    }
  });

  // 处理新打开的标签页（如果正在录制且是从录制页打开的）
  chrome.tabs.onCreated.addListener((tab) => {
    recordingManager.handleTabCreatedForRecording(tab);
  });
}

