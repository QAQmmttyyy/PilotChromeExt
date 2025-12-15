// Isolated World Content Script
// Pilot: Pure Bridge - 只做通信，不管业务逻辑
console.log('Pilot Bridge (Isolated World) loaded');

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
