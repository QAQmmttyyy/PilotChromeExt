// ============== Page Injection Utilities ==============
export function isInjectablePage(url: string | undefined): boolean {
  if (!url) return false;
  const blockedPrefixes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
    'view-source:',
  ];
  return !blockedPrefixes.some(prefix => url.startsWith(prefix));
}

export async function ensureContentScriptReady(tabId: number): Promise<void> {
  // 尝试 ping content script，检查是否已注入
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    console.log('[Pilot Engine] Content script already active');
    return;
  } catch {
    // Content script 未响应，需要刷新页面让 manifest 自动注入
    // 注意：不使用 chrome.scripting.executeScript 手动注入，因为构建后的文件名带 hash
    console.log('[Pilot Engine] Content script not active, reloading page...');
    await chrome.tabs.reload(tabId);
  }
}

