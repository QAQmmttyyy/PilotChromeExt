// Main World Content Script
// Pilot: Pure Bridge - 只做通信，不管业务逻辑
console.log('Pilot Bridge (Main World) loaded');

window.Pilot = {
  // 浏览器能力
  openTab: (url: string) => {
    window.postMessage({ source: 'PILOT_SCRIPT', action: 'openTab', payload: { url } }, '*');
  },
  
  // 日志
  log: (msg: string) => console.log('[Pilot]', msg),
  
  // 工作流控制（异步通信/发布订阅）
  workflow: {
    next: (data?: any) => {
      console.log('[Pilot] Step completed, signaling...');
      // 清理 PilotData
      delete (window as any).PilotData;
      window.postMessage({ 
        source: 'PILOT_SCRIPT', 
        action: 'workflowNext', 
        payload: { data } 
      }, '*');
    },
    finish: () => {
      console.log('[Pilot] Workflow finished');
      delete (window as any).PilotData;
      window.postMessage({ source: 'PILOT_SCRIPT', action: 'workflowFinish', payload: {} }, '*');
    },
    fail: (reason: string) => {
      console.error('[Pilot] Workflow FAILED:', reason);
      delete (window as any).PilotData;
      window.postMessage({ source: 'PILOT_SCRIPT', action: 'workflowFail', payload: { reason } }, '*');
    }
  }
};
