// 这个脚本直接运行在页面上下文 (Main World)
console.log('Pilot Main World script loaded');

window.Pilot = {
  openTab: (url: string) => window.postMessage({ source: 'PILOT_SCRIPT', action: 'openTab', payload: { url } }, '*'),
  log: (msg: string) => console.log('[Pilot Script]', msg),
  setData: (key: string, value: any) => window.postMessage({ source: 'PILOT_SCRIPT', action: 'setData', payload: { key, value } }, '*'),
  getData: (_key: string) => console.warn('Pilot.getData not implemented yet'),

  workflow: {
    next: (data?: any) => {
      console.log('[Pilot Workflow] Step completed, signalling background...');
      window.postMessage({ 
        source: 'PILOT_SCRIPT', 
        action: 'workflowNext', 
        payload: { data } 
      }, '*');
    },
    finish: () => {
      window.postMessage({ source: 'PILOT_SCRIPT', action: 'workflowFinish', payload: {} }, '*');
    },
    fail: (reason: string) => {
      console.error('[Pilot Workflow] Step FAILED:', reason);
      window.postMessage({ source: 'PILOT_SCRIPT', action: 'workflowFail', payload: { reason } }, '*');
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
