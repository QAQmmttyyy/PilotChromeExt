import { ReadyEventType } from '../lib/types';
import * as pageReadyManager from './managers/page-ready';
import * as workflowManager from './managers/workflow';
import * as navigationManager from './managers/navigation';
import { parseScriptToWorkflow } from '../lib/parser';
import type { PageAgentLogEntry } from '@pilot/shared';

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

  if (request.type === 'PAGEAGENT_STEP') {
    // Forward PageAgent logs to workflow manager
    const tabId = sender.tab?.id;
    if (tabId) {
      const workflow = workflowManager.getWorkflow(tabId);
      if (workflow) {
        const payload = request.payload as PageAgentLogEntry;
        workflowManager.forwardPageAgentLog(
          tabId,
          workflow.currentStepIndex,
          payload
        );
      }
    }
  } else if (request.type === 'PILOT_BRIDGE_ACTION') {
    workflowManager.handleBridgeAction(request.action, request.payload, sender);
  } else if (request.type === 'START_WORKFLOW') {
    const { steps, script, tabId, toolCallId } = request.payload;
    const workflowSteps = steps || (script ? parseScriptToWorkflow(script) : []);
    workflowManager.prepareAndStartWorkflow(workflowSteps, tabId, toolCallId);
  } else if (request.type === 'STOP_WORKFLOW') {
    const { tabId } = request.payload;
    workflowManager.stopWorkflow(tabId);
    sendResponse({ success: true });
  }
});
