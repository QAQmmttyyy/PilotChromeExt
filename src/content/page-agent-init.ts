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
    // Create PageAgent with proper hooks
    (window as any).pageAgent = new PageAgent({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: baseURL,
      
      // Disable ask_user tool - never ask user questions
      customTools: {
        ask_user: null,
      },
      
      onBeforeTask: async function(this: InstanceType<typeof PageAgent>) {
        console.log('[PageAgent] Task starting');
        
        // Intercept new page opens
        document.querySelectorAll('a[target="_blank"]').forEach(el => {
          el.removeAttribute('target');
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
        }
      },
      
      onAfterStep: async function(this: InstanceType<typeof PageAgent>, stepCnt: number, history: any[]) {
        console.log(`[PageAgent] Step ${stepCnt} completed`, history);
        
        const lastStep = history[history.length - 1];
        if (lastStep) {
          const { action, brain, usage } = lastStep;
          
          // Send detailed step log
          window.postMessage({
            source: 'PILOT_PAGEAGENT',
            type: 'PAGEAGENT_STEP',
            action: action.name || '未知操作',
            status: 'success',
            stepNumber: stepCnt,
            details: action.output && action.output.length < 500 ? action.output : undefined,
            metadata: {
              actionName: action.name,
              input: action.input,
              thinking: brain?.thinking,
              usage: usage ? {
                tokens: usage.totalTokens,
                cached: usage.cachedTokens
              } : undefined
            }
          }, '*');
        }
      },
      
      onAfterTask: async function(this: InstanceType<typeof PageAgent>, result: any) {
        console.log('[PageAgent] Task completed', result);
        
        // Send task completion log
        window.postMessage({
          source: 'PILOT_PAGEAGENT',
          type: 'PAGEAGENT_STEP',
          action: 'done',
          status: result.success ? 'success' : 'error',
          details: result.data,
        }, '*');
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

