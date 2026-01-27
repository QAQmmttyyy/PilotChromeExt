// Main World Content Script
// Pilot: Pure Bridge - 只做通信，不管业务逻辑
// Note: PageAgent is NOT imported here to avoid CSS injection on load
// PageAgent will be dynamically injected by background script when needed

console.log('Pilot Bridge (Main World) loaded');

// Store config for lazy initialization
let savedConfig: { apiKey: string; model: string; endpoint?: string } | null = null;

window.addEventListener('message', async (event) => {
  if (event.source !== window || !event.data || event.data.source !== 'PILOT_ISOLATED') {
    return;
  }
  
  if (event.data.type === 'SET_AI_CONFIG') {
    const config = event.data.payload;
    if (config && config.apiKey) {
      savedConfig = config;
      console.log('[Pilot] AI Config saved (PageAgent will be created on demand)');
    } else {
      savedConfig = null;
      console.warn('[Pilot] AI Config received but apiKey is missing.');
    }
    
    window.postMessage({
      source: 'PILOT_MAIN',
      type: 'PAGE_AGENT_READY'
    }, '*');
  }
  
  if (event.data.type === 'GET_SAVED_CONFIG') {
    window.postMessage({
      source: 'PILOT_MAIN',
      type: 'SAVED_CONFIG_RESPONSE',
      payload: savedConfig
    }, '*');
  }

  if (event.data.type === 'DISPOSE_PAGE_AGENT') {
    const agent = (window as any).pageAgent;
    if (agent) {
      console.log('[Pilot] Disposing PageAgent');
      try {
        if (typeof agent.dispose === 'function') {
          agent.dispose();
        }
        (window as any).pageAgent = null;
      } catch (e) {
        console.warn('[Pilot] Error disposing PageAgent:', e);
      }
    }
  }

  if (event.data.type === 'STOP_PAGE_AGENT') {
    const agent = (window as any).pageAgent;
    if (agent) {
      console.log('[Pilot] Stopping PageAgent');
      try {
        if (typeof agent.stop === 'function') {
          agent.stop();
        } else if (typeof agent.dispose === 'function') {
          agent.dispose();
        }
      } catch (e) {
        console.warn('[Pilot] Error stopping PageAgent:', e);
      }
    }
  }
});

window.postMessage({
  source: 'PILOT_MAIN',
  type: 'MAIN_WORLD_READY'
}, '*');

window.Pilot = {
  openTab: (url: string) => {
    window.postMessage({ source: 'PILOT_SCRIPT', action: 'openTab', payload: { url } }, '*');
  },
  
  log: (msg: string) => console.log('[Pilot]', msg),
  
  workflow: {
    next: (data?: any) => {
      console.log('[Pilot] Step completed, signaling...');
      delete (window as any).PilotData;
      window.postMessage({ 
        source: 'PILOT_SCRIPT', 
        action: 'workflowNext', 
        payload: { data } 
      }, '*');
    },
    finish: (data?: any) => {
      console.log('[Pilot] Workflow finished');
      delete (window as any).PilotData;
      window.postMessage({ source: 'PILOT_SCRIPT', action: 'workflowFinish', payload: { data } }, '*');
    },
    fail: (reason: string) => {
      console.error('[Pilot] Workflow FAILED:', reason);
      delete (window as any).PilotData;
      window.postMessage({ source: 'PILOT_SCRIPT', action: 'workflowFail', payload: { reason } }, '*');
    }
  }
};

// Export savedConfig getter for use in dynamic script injection
(window as any).__pilotGetSavedConfig = () => savedConfig;
