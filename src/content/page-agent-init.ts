// Page Agent Initialization Script
// This script is dynamically injected by background script when needed
// It contains page-agent import which will inject CSS on load

import { PageAgent } from 'page-agent';

console.log('[Pilot] Page Agent Init script loaded');

async function initPageAgent() {
  const config = (window as any).__pilotGetSavedConfig?.();
  
  if (!config || !config.apiKey) {
    console.error('[Pilot] Cannot create PageAgent: no valid config');
    window.postMessage({
      source: 'PILOT_MAIN',
      type: 'PAGE_AGENT_CREATE_RESULT',
      success: false,
      error: 'No valid config'
    }, '*');
    return;
  }

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

  const baseURL = config.endpoint ? config.endpoint.replace('/chat/completions', '') : 'https://openrouter.ai/api/v1';
  
  if (typeof console.group !== 'function') {
    console.group = (...args: any[]) => console.log('[GROUP]', ...args);
  }
  if (typeof console.groupEnd !== 'function') {
    console.groupEnd = () => {};
  }

  try {
    (window as any).pageAgent = new PageAgent({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: baseURL,
      onBeforeStep: async function(this: InstanceType<typeof PageAgent>) {
        document.querySelectorAll('a[target="_blank"]').forEach(el => {
          el.removeAttribute('target');
          console.log('[Pilot] Removed target="_blank" from:', el);
        });

        if (!(window as any).__pilotOpenIntercepted) {
          const originalOpen = window.open;
          (window as any).__pilotOriginalOpen = originalOpen;
          (window as any).__pilotOpenIntercepted = true;
          
          window.open = function(url?: string | URL, _target?: string, _features?: string): Window | null {
            if (url) {
              const urlStr = url.toString();
              console.log('[Pilot] Intercepted window.open, navigating in current page:', urlStr);
              location.href = urlStr;
            }
            return null;
          };
          console.log('[Pilot] window.open intercepted');
        }
      },
    });

    console.log('[Pilot] PageAgent created successfully');
    window.postMessage({
      source: 'PILOT_MAIN',
      type: 'PAGE_AGENT_CREATE_RESULT',
      success: true
    }, '*');
  } catch (e) {
    console.error('[Pilot] Failed to create PageAgent:', e);
    window.postMessage({
      source: 'PILOT_MAIN',
      type: 'PAGE_AGENT_CREATE_RESULT',
      success: false,
      error: String(e)
    }, '*');
  }
}

initPageAgent();

