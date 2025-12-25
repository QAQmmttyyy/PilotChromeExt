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
      // 增加配置指纹检查，避免不必要的重新初始化
      const configHash = JSON.stringify(config);
      const alreadyInitialized = (window as any).__lastAgentConfig === configHash && (window as any).pageAgent && !(window as any).pageAgent.disposed;
      
      if (alreadyInitialized) {
        // 配置没变且实例可用，直接发送就绪信号即可
        console.log('[Pilot] PageAgent already initialized and ready');
        window.postMessage({
          source: 'PILOT_MAIN',
          type: 'PAGE_AGENT_READY'
        }, '*');
        return;
      }
      
      (window as any).__lastAgentConfig = configHash;

      // 1. 如果已有实例，先销毁
      const oldAgent = (window as any).pageAgent;
      if (oldAgent) {
        console.log('[Pilot] Disposing old PageAgent instance');
        try {
          if (typeof oldAgent.dispose === 'function') {
            oldAgent.dispose();
          }
        } catch (e) {
          console.warn('[Pilot] Error disposing PageAgent:', e);
        }
      }

      // 2. 初始化新实例
      console.log('[Pilot] Re-initializing PageAgent');
      const baseURL = config.endpoint ? config.endpoint.replace('/chat/completions', '') : 'https://openrouter.ai/api/v1';
      
      try {
        (window as any).pageAgent = new PageAgent({
          apiKey: config.apiKey,
          model: config.model,
          baseURL: baseURL,
        });
        console.log('[Pilot] PageAgent initialized successfully');
        
        // 发送 PageAgent 就绪信号
        window.postMessage({
          source: 'PILOT_MAIN',
          type: 'PAGE_AGENT_READY'
        }, '*');
      } catch (e) {
        console.error('[Pilot] Failed to initialize PageAgent:', e);
        // 即使初始化失败，也发送就绪信号，让流程继续
        window.postMessage({
          source: 'PILOT_MAIN',
          type: 'PAGE_AGENT_READY'
        }, '*');
      }
    } else {
      console.warn('[Pilot] AI Config received but apiKey is missing. PageAgent will not be initialized.');
      // 即使没有 API Key，也发送就绪信号，让流程继续
      window.postMessage({
        source: 'PILOT_MAIN',
        type: 'PAGE_AGENT_READY'
      }, '*');
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
