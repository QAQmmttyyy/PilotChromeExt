import type { ChromeApiOutput, ChromeApiToolName } from '@pilot/shared';

interface ChromeApiParams {
  url?: string;
  tabId?: number;
  active?: boolean;
  currentWindow?: boolean;
}

export async function executeChromeApi(
  action: ChromeApiToolName,
  params?: ChromeApiParams
): Promise<ChromeApiOutput> {
  console.log('[ChromeApi Executor] Action:', action, 'Params:', params);
  
  try {
    let data: unknown;

    switch (action) {
      case 'create_tab': {
        const tab = await chrome.tabs.create({
          url: params?.url,
          active: params?.active ?? true,
        });
        data = {
          tabId: tab.id,
          url: tab.url || tab.pendingUrl,
          title: tab.title,
          active: tab.active,
        };
        break;
      }

      case 'update_tab': {
        const tabId = params?.tabId;
        if (!tabId && params?.url) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab?.id) {
            return { success: false, error: 'No active tab found' };
          }
          const tab = await chrome.tabs.update(activeTab.id, { url: params.url });
          if (!tab) {
            return { success: false, error: 'Failed to update tab' };
          }
          data = {
            tabId: tab.id,
            url: tab.url || tab.pendingUrl,
            title: tab.title,
          };
        } else if (tabId) {
          const updateProps: chrome.tabs.UpdateProperties = {};
          if (params?.url) updateProps.url = params.url;
          if (params?.active !== undefined) updateProps.active = params.active;
          
          const tab = await chrome.tabs.update(tabId, updateProps);
          if (!tab) {
            return { success: false, error: 'Failed to update tab' };
          }
          data = {
            tabId: tab.id,
            url: tab.url || tab.pendingUrl,
            title: tab.title,
          };
        } else {
          return { success: false, error: 'tabId or url is required for update_tab' };
        }
        break;
      }

      case 'close_tab': {
        const tabId = params?.tabId;
        if (!tabId) {
          return { success: false, error: 'tabId is required for close_tab' };
        }
        await chrome.tabs.remove(tabId);
        data = { closed: true, tabId };
        break;
      }

      case 'get_tab': {
        const tabId = params?.tabId;
        if (!tabId) {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab) {
            return { success: false, error: 'No active tab found' };
          }
          data = {
            tabId: activeTab.id,
            url: activeTab.url,
            title: activeTab.title,
            active: activeTab.active,
            status: activeTab.status,
          };
        } else {
          const tab = await chrome.tabs.get(tabId);
          data = {
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.active,
            status: tab.status,
          };
        }
        break;
      }

      case 'query_tabs': {
        const queryInfo: chrome.tabs.QueryInfo = {};
        if (params?.active !== undefined) queryInfo.active = params.active;
        if (params?.currentWindow !== undefined) queryInfo.currentWindow = params.currentWindow;
        
        const tabs = await chrome.tabs.query(queryInfo);
        data = tabs.map(tab => ({
          tabId: tab.id,
          url: tab.url,
          title: tab.title,
          active: tab.active,
          status: tab.status,
        }));
        break;
      }

      case 'capture_screenshot': {
        let dataUrl: string;
        
        if (params?.tabId) {
          const tab = await chrome.tabs.get(params.tabId);
          
          if (!tab.active) {
            await chrome.tabs.update(params.tabId, { active: true });
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId);
        } else {
          dataUrl = await chrome.tabs.captureVisibleTab();
        }
        
        data = { 
          screenshot: dataUrl,
          tabId: params?.tabId,
        };
        break;
      }

      default:
        return { success: false, error: `Unknown action: ${action}` };
    }

    console.log('[ChromeApi Executor] Result:', data);
    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[ChromeApi Executor] Error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
