import { ReadyEventType } from '../lib/types';
import * as pageReadyManager from './managers/page-ready';
import * as recordingManager from './managers/recording';
import * as workflowManager from './managers/workflow';
import * as navigationManager from './managers/navigation';

console.log('Pilot background script loaded');

// 点击扩展图标时打开 sidepanel
chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// 初始化导航监听
navigationManager.setupNavigationListeners();

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
      
      pageReadyManager.handleReadyEvent({
        type: request.type as ReadyEventType,
        tabId,
        timestamp: Date.now()
      });
    }
    sendResponse({ success: true });
    return;
  }

  if (request.type === 'PILOT_BRIDGE_ACTION') {
    workflowManager.handleBridgeAction(request.action, request.payload, sender);
  } else if (request.type === 'START_WORKFLOW') {
    const { steps, tabId } = request.payload;
    workflowManager.prepareAndStartWorkflow(steps, tabId);
  } else if (request.type === 'RECORDING_STEP') {
    recordingManager.addStepToSession(request.payload);
  } else if (request.type === 'RECORDING_START') {
    const { tabId, scriptId } = request.payload;
    recordingManager.startRecording(tabId, scriptId).then(() => {
      sendResponse({ success: true, session: recordingManager.getSession(scriptId) });
    });
    return true;
  } else if (request.type === 'RECORDING_STOP') {
    const activeScriptId = recordingManager.getActiveScriptId();
    recordingManager.stopRecording().then(() => {
      sendResponse({ success: true, session: activeScriptId ? recordingManager.getSession(activeScriptId) : null });
    });
    return true;
  } else if (request.type === 'RECORDING_PAUSE') {
    const activeScriptId = recordingManager.getActiveScriptId();
    recordingManager.pauseRecording().then(() => {
      sendResponse({ success: true, session: activeScriptId ? recordingManager.getSession(activeScriptId) : null });
    });
    return true;
  } else if (request.type === 'RECORDING_RESUME') {
    const activeScriptId = recordingManager.getActiveScriptId();
    recordingManager.resumeRecording().then(() => {
      sendResponse({ success: true, session: activeScriptId ? recordingManager.getSession(activeScriptId) : null });
    });
    return true;
  } else if (request.type === 'RECORDING_GET_SESSION') {
    const { scriptId } = request.payload || {};
    const isRestoring = recordingManager.getIsRestoring();
    console.log('[Pilot BG] RECORDING_GET_SESSION for scriptId:', scriptId, 'isRestoring:', isRestoring);
    
    if (!scriptId) {
      sendResponse({ session: null });
      return;
    }

    const sendRes = () => {
      const session = recordingManager.getSession(scriptId) || null;
      console.log('[Pilot BG] Returning session for', scriptId, ':', session ? `${session.steps?.length} steps` : 'null');
      sendResponse({ session });
    };

    if (isRestoring) {
      console.log('[Pilot BG] Still restoring, fetching from storage...');
      recordingManager.ensureRestored().then(() => {
        sendRes();
      });
      return true;
    } else {
      sendRes();
    }
  } else if (request.type === 'RECORDING_DELETE_STEP') {
    const { scriptId, stepId } = request.payload;
    recordingManager.deleteStep(scriptId, stepId);
    sendResponse({ success: true, session: recordingManager.getSession(scriptId) });
  } else if (request.type === 'RECORDING_UPDATE_STEP') {
    const { scriptId, stepId, updates } = request.payload;
    recordingManager.updateStep(scriptId, stepId, updates);
    sendResponse({ success: true, session: recordingManager.getSession(scriptId) });
  } else if (request.type === 'RECORDING_ADD_AI_STEP') {
    const { scriptId, instruction } = request.payload;
    recordingManager.addAiStep(scriptId, instruction);
    // addAiStep is async (tabs.query), but we return success immediately, updates via notification
    sendResponse({ success: true, session: recordingManager.getSession(scriptId) });
  } else if (request.type === 'RECORDING_CLEAR') {
    const { scriptId } = request.payload;
    recordingManager.clearRecording(scriptId);
    sendResponse({ success: true });
  } else if (request.type === 'RECORDING_GET_STATUS') {
    const checkStatus = () => {
      const activeScriptId = recordingManager.getActiveScriptId();
      const session = activeScriptId ? recordingManager.getSession(activeScriptId) : null;
      sendResponse({
        isRecording: activeScriptId !== null && session?.status === 'recording',
        activeScriptId,
        session
      });
    };

    if (recordingManager.getIsRestoring()) {
       recordingManager.ensureRestored().then(checkStatus);
      return true;
    } else {
      checkStatus();
    }
  }
});
