import * as workflowManager from './workflow';

// ============== Navigation Tracking ==============

export function setupNavigationListeners() {
  // 监听导航开始事件
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;

    const tabId = details.tabId;
    const workflow = workflowManager.getWorkflow(tabId);

    if (workflow && workflow.status === 'running') {
      console.log(`[Pilot Engine] Navigation detected in Tab ${tabId}: ${details.url}`);
    }
  });

  // 监听 History State 更新（SPA 内导航）
  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;

    const tabId = details.tabId;
    const workflow = workflowManager.getWorkflow(tabId);
    
    if (workflow && workflow.status === 'running') {
      console.log(`[Pilot Engine] History state updated in Tab ${tabId}: ${details.url}`);
    }
  });
}

