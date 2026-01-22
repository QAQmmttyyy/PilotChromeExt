// Isolated World Content Script
// Pilot: Pure Bridge + Recording Event Capture
import { createStepPayload } from '../lib/recorder';
import { RecordingStepPayload } from '../lib/types';
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

// ============== Recording State ==============
let isRecording = false;
let lastInputElement: Element | null = null;
let inputDebounceTimer: number | null = null;

// ============== Recording Event Capture ==============
function sendRecordingStep(payload: RecordingStepPayload) {
  if (!isRecording) return;
  
  // 使用 chrome.runtime.sendMessage 发送
  // 不需要 await，因为我们希望尽可能快地发出，即使页面即将卸载
  chrome.runtime.sendMessage({
    type: 'RECORDING_STEP',
    payload
  }).catch(err => console.debug('[Pilot Recording] Send error (expected on nav):', err));
}

function handleClick(e: MouseEvent) {
  if (!isRecording) return;
  
  const target = e.target as Element;
  if (!target) return;
  
  // 找到可点击的祖先元素，如果没有就使用 target 本身
  const clickable = target as HTMLElement;
  
  const tag = clickable.tagName.toLowerCase();

  // input/textarea 的点击不单独记录（会记录输入）
  // if (tag === 'input' || tag === 'textarea') return;
  
  // 过滤掉 body/html 等顶层元素的点击
  if (tag === 'body' || tag === 'html') return;
  
  const payload = createStepPayload('click', clickable);
  
  // 如果是链接或提交按钮，可能会导致页面跳转
  // 我们尽可能快地发出消息
  sendRecordingStep(payload);
  
  console.log('[Pilot Recording] Click captured:', payload);
}

function handleInput(e: Event) {
  if (!isRecording) return;
  
  const target = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (!target) return;
  
  const tag = target.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') return;
  
  // 防抖处理：用户可能连续输入
  lastInputElement = target;
  
  if (inputDebounceTimer) {
    clearTimeout(inputDebounceTimer);
  }
  
  inputDebounceTimer = window.setTimeout(() => {
    if (!lastInputElement) return;
    
    const inputTarget = lastInputElement as HTMLInputElement;
    const isPassword = inputTarget.type === 'password';
    
    const payload = createStepPayload(
      'input',
      lastInputElement,
      isPassword ? '***' : inputTarget.value
    );
    sendRecordingStep(payload);
    
    console.log('[Pilot Recording] Input:', payload);
    lastInputElement = null;
  }, 500);
}

function handleSubmit(e: Event) {
  if (!isRecording) return;
  
  const target = e.target as HTMLFormElement;
  if (!target || target.tagName.toLowerCase() !== 'form') return;
  
  const payload = createStepPayload('submit', target);
  sendRecordingStep(payload);
  
  console.log('[Pilot Recording] Submit:', payload);
}

function handleChange(e: Event) {
  if (!isRecording) return;
  
  const target = e.target as HTMLSelectElement;
  if (!target || target.tagName.toLowerCase() !== 'select') return;
  
  const payload = createStepPayload('select', target, target.value);
  sendRecordingStep(payload);
  
  console.log('[Pilot Recording] Select:', payload);
}

function handleKeydown(e: KeyboardEvent) {
  if (!isRecording) return;
  
  // 只记录特殊按键（Enter, Escape, Tab 等）
  const specialKeys = ['Enter', 'Escape', 'Tab'];
  if (!specialKeys.includes(e.key)) return;
  
  const target = e.target as Element;
  const payload = createStepPayload('keypress', target, undefined, e.key);
  sendRecordingStep(payload);
  
  console.log('[Pilot Recording] Keypress:', payload);
}

function startEventCapture() {
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('submit', handleSubmit, true);
  document.addEventListener('change', handleChange, true);
  document.addEventListener('keydown', handleKeydown, true);
  console.log('[Pilot Recording] Event capture started');
}

function stopEventCapture() {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('submit', handleSubmit, true);
  document.removeEventListener('change', handleChange, true);
  document.removeEventListener('keydown', handleKeydown, true);
  console.log('[Pilot Recording] Event capture stopped');
}

// 监听来自 Background 的录制控制消息
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.type === 'PING') {
    sendResponse({ pong: true });
    return;
  }
  
  if (request.type === 'RECORDING_CONTROL') {
    const { action } = request;
    
    if (action === 'start' || action === 'resume') {
      isRecording = true;
      startEventCapture();
      sendResponse({ success: true });
    } else if (action === 'stop' || action === 'pause') {
      isRecording = false;
      stopEventCapture();
      sendResponse({ success: true });
    } else if (action === 'status') {
      sendResponse({ isRecording });
    }
    
    return true;
  } else if (request.type === 'RESET_AGENT') {
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
  }
});

// 初始化：询问 Background 是否正在录制
chrome.runtime.sendMessage({ type: 'RECORDING_GET_STATUS' }).then(response => {
  if (response?.isRecording) {
    isRecording = true;
    startEventCapture();
    console.log('[Pilot Recording] Resumed recording state from background');
  }
}).catch(() => {
  // 忽略扩展环境未准备好的错误
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
