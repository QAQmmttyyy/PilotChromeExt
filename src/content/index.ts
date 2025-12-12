// Isolated World Content Script
console.log('Pilot content script (Isolated) loaded');

// 1. 监听来自页面脚本(Main World)的消息
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

// 2. 为 Isolated World 注入 Pilot API
(window as any).Pilot = {
  openTab: (url: string) => {
    chrome.runtime.sendMessage({ 
      type: 'PILOT_BRIDGE_ACTION', 
      action: 'openTab', 
      payload: { url } 
    });
  },
  
  log: (msg: string) => console.log('[Pilot Script Isolated]', msg),
  
  setData: (key: string, value: any) => {
    chrome.runtime.sendMessage({ 
      type: 'PILOT_BRIDGE_ACTION', 
      action: 'setData', 
      payload: { key, value } 
    });
  },

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
  },

  // 工具函数：轮询等待元素出现
  waitFor: (selector: string, timeout = 10000): Promise<Element> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const check = () => {
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`超时: 未找到元素 "${selector}" (${timeout}ms)`));
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  }
};
