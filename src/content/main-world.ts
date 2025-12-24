// Main World Content Script
// Pilot: Pure Bridge - 只做通信，不管业务逻辑
import { PageAgent } from 'page-agent';

console.log('Pilot Bridge (Main World) loaded');

// 监听来自 Isolated World 的配置
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.source !== 'PILOT_ISOLATED') {
    return;
  }
  
  if (event.data.type === 'SET_AI_CONFIG') {
    const config = event.data.payload;
    if (config && config.apiKey) {
      // 初始化 or 更新 PageAgent
      console.log('[Pilot] Received AI config update');
      const baseURL = config.endpoint ? config.endpoint.replace('/chat/completions', '') : 'https://openrouter.ai/api/v1';
      
      try {
        (window as any).pageAgent = new PageAgent({
          apiKey: config.apiKey,
          model: config.model,
          baseURL: baseURL,
        });
        console.log('[Pilot] PageAgent initialized successfully');
      } catch (e) {
        console.error('[Pilot] Failed to initialize PageAgent:', e);
      }
    } else {
      console.warn('[Pilot] AI Config received but apiKey is missing. PageAgent will not be initialized.');
    }
  }
});

// 通知 Isolated World：Main World 已就绪，请求配置
window.postMessage({
  source: 'PILOT_MAIN',
  type: 'MAIN_WORLD_READY'
}, '*');

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
