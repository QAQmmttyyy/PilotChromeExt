// Isolated World Content Script
// Pilot: Pure Bridge + Recording Event Capture
import { createStepPayload, findClickableAncestor, shouldRecordClick } from '../lib/recorder';
import { RecordingStepPayload } from '../lib/types';

console.log('Pilot Bridge (Isolated World) loaded');

// ============== Recording State ==============
let isRecording = false;
let lastInputElement: Element | null = null;
let inputDebounceTimer: number | null = null;

// ============== Recording Event Capture ==============
function sendRecordingStep(payload: RecordingStepPayload) {
  if (!isRecording) return;
  
  chrome.runtime.sendMessage({
    type: 'RECORDING_STEP',
    payload
  }).catch(err => console.error('[Pilot Recording] Error:', err));
}

function handleClick(e: MouseEvent) {
  if (!isRecording) return;
  
  const target = e.target as Element;
  if (!target) return;
  
  // 找到可点击的祖先元素
  const clickable = findClickableAncestor(target) || target;
  
  // 过滤掉不需要记录的点击
  if (!shouldRecordClick(clickable)) return;
  
  // input/textarea 的点击不单独记录（会记录输入）
  const tag = clickable.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;
  
  const payload = createStepPayload('click', clickable);
  sendRecordingStep(payload);
  
  console.log('[Pilot Recording] Click:', payload);
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
  if (request.type === 'RECORDING_CONTROL') {
    const { action } = request;
    
    if (action === 'start') {
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
    finish: () => {
      chrome.runtime.sendMessage({ 
        type: 'PILOT_BRIDGE_ACTION', 
        action: 'workflowFinish', 
        payload: {} 
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
