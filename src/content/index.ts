// Isolated World Content Script
// Pilot: Pure Bridge
import { settings } from '../lib/settings';
import type { PageAgentWindowMessage } from '@pilot/shared';

console.log('Pilot Bridge (Isolated World) loaded');

// Note: Main world script injection is handled by background script
// via chrome.scripting.executeScript with world: 'MAIN'
// This is more reliable than dynamic injection and bypasses CSP issues

// ============== Ready Event System ==============
let pageAgentReady = false;
let contentScriptReady = false;

// 发送就绪事件到 Background
function sendReadyEvent(type: 'CONTENT_SCRIPT_READY' | 'PAGE_AGENT_READY' | 'PAGE_FULLY_READY') {
  chrome.runtime.sendMessage({
    type,
    timestamp: Date.now()
  }).catch(() => {
    console.warn(`[Pilot] Failed to send ${type} event`);
  });
}

// 立即发送 Content Script 就绪信号
contentScriptReady = true;
sendReadyEvent('CONTENT_SCRIPT_READY');
console.log('[Pilot] Content Script ready signal sent');

// 检查是否完全就绪
function checkFullyReady() {
  if (contentScriptReady && pageAgentReady) {
    sendReadyEvent('PAGE_FULLY_READY');
    console.log('[Pilot] Page fully ready signal sent');
  }
}

// ============== Initial Configuration ==============
function syncAIConfig() {
  settings.getAIConfig().then(config => {
    window.postMessage({
      source: 'PILOT_ISOLATED',
      type: 'SET_AI_CONFIG',
      payload: config
    }, '*');
  });
}

syncAIConfig();

// 监听来自 Main World 的信号
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data) {
    return;
  }
  
  // Handle PILOT_MAIN messages
  if (event.data.source === 'PILOT_MAIN') {
    if (event.data.type === 'MAIN_WORLD_READY') {
      console.log('[Pilot] Main World ready, syncing config');
      syncAIConfig();
    } else if (event.data.type === 'PAGE_AGENT_READY') {
      console.log('[Pilot] PageAgent ready signal received from Main World');
      pageAgentReady = true;
      sendReadyEvent('PAGE_AGENT_READY');
      checkFullyReady();
    } else if (event.data.type === 'PAGE_AGENT_CREATE_RESULT') {
      console.log('[Pilot] PageAgent create result:', event.data.success);
      chrome.runtime.sendMessage({
        type: 'PAGE_AGENT_CREATE_RESULT',
        success: event.data.success,
        error: event.data.error
      }).catch(() => {});
    }
  }
  
  // Handle PageAgent execution logs
  if (event.data.source === 'PILOT_PAGEAGENT' && event.data.type === 'PAGEAGENT_STEP') {
    const message = event.data as PageAgentWindowMessage;
    console.log('[Pilot] PageAgent step:', message);
    chrome.runtime.sendMessage({
      type: 'PAGEAGENT_STEP',
      payload: message.payload
    }).catch(() => {});
  }
});

// 监听存储变化，实时同步配置到 Main World
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.pilot_settings) {
    console.log('[Pilot] Settings changed, syncing to Main World');
    syncAIConfig();
  }
});

// 监听来自 Background 的消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ pong: true });
    return;
  }
  
  if (request.type === 'RESET_AGENT') {
    console.log('[Pilot] Received RESET_AGENT request');
    syncAIConfig();
    return true;
  } else if (request.type === 'DISPOSE_PAGE_AGENT') {
    console.log('[Pilot] Received DISPOSE_PAGE_AGENT request');
    window.postMessage({
      source: 'PILOT_ISOLATED',
      type: 'DISPOSE_PAGE_AGENT'
    }, '*');
    sendResponse({ forwarded: true });
    return true;
  } else if (request.type === 'STOP_PAGE_AGENT') {
    console.log('[Pilot] Received STOP_PAGE_AGENT request');
    window.postMessage({
      source: 'PILOT_ISOLATED',
      type: 'STOP_PAGE_AGENT'
    }, '*');
    sendResponse({ forwarded: true });
    return true;
  }
});

// ============== Original Bridge Logic ==============

// 1. 监听来自 Main World 的消息
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.source !== 'PILOT_SCRIPT') {
    return;
  }
  const { action, payload } = event.data;
  
  chrome.runtime.sendMessage({
    type: 'PILOT_BRIDGE_ACTION',
    action,
    payload
  }).catch(err => console.error('Pilot Bridge Error:', err));
});

// 2. Pilot API for Isolated World (Pure Bridge)
(window as any).Pilot = {
  // 浏览器能力
  openTab: (url: string) => {
    chrome.runtime.sendMessage({ 
      type: 'PILOT_BRIDGE_ACTION', 
      action: 'openTab', 
      payload: { url } 
    });
  },
  
  // 日志
  log: (msg: string) => console.log('[Pilot]', msg),
  
  // 工作流控制（异步通信）
  workflow: {
    next: (data?: any) => {
      chrome.runtime.sendMessage({ 
        type: 'PILOT_BRIDGE_ACTION', 
        action: 'workflowNext', 
        payload: { data } 
      });
    },
    finish: (data?: any) => {
      chrome.runtime.sendMessage({ 
        type: 'PILOT_BRIDGE_ACTION', 
        action: 'workflowFinish', 
        payload: { data } 
      });
    },
    fail: (reason: string) => {
      chrome.runtime.sendMessage({ 
        type: 'PILOT_BRIDGE_ACTION', 
        action: 'workflowFail', 
        payload: { reason } 
      });
    }
  }
};
