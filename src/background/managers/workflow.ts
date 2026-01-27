import { WorkflowContext, WorkflowStep } from '../../lib/types';
import { ensureContentScriptReady, isInjectablePage } from '../utils';
import { waitForPageReady } from './page-ready';
import type { WorkflowProgressMessage, WorkflowStatusMessage, PageAgentLogMessage, PageAgentLogEntry } from '@pilot/shared';

// ============== Step Completion System ==============
type StepCompletionType = 'signal' | 'mpa_navigation' | 'spa_navigation';

interface StepCompletionResolver {
  resolve: (type: StepCompletionType) => void;
  reject: (reason: string) => void;
  cleanup: () => void;
  executingStepIndex: number;
}

const stepCompletionResolvers = new Map<number, StepCompletionResolver>();
const workflows = new Map<number, WorkflowContext>();

export function getWorkflow(tabId: number) {
  return workflows.get(tabId);
}

export function forwardPageAgentLog(
  tabId: number,
  stepIndex: number,
  log: PageAgentLogEntry
) {
  notifyPageAgentLog(tabId, stepIndex, log);
}

function normalizeUrlForCompare(url?: string) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Ignore hash to avoid false mismatches
    let pathname = u.pathname || '/';
    // Normalize trailing slash except for root
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    return `${u.origin}${pathname}${u.search}`;
  } catch {
    // Best-effort fallback
    return url.replace(/#.*$/, '').replace(/\/$/, '');
  }
}

// Create PageAgent on demand before executing AI steps
async function createPageAgentOnDemand(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', messageListener);
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('PageAgent creation timed out'));
    }, 10000);

    const listener = (message: any) => {
      if (message.type === 'PAGE_AGENT_CREATE_RESULT') {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(listener);
        if (message.success) {
          console.log('[Pilot Engine] PageAgent created successfully');
          resolve();
        } else {
          reject(new Error(message.error || 'Failed to create PageAgent'));
        }
      }
    };

    const messageListener = () => { };

    chrome.runtime.onMessage.addListener(listener);

    // Inject page-agent-init.js into the page
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['page-agent-init.js'],
      world: 'MAIN'
    }).catch(err => {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(listener);
      reject(err);
    });
  });
}

function waitForStepCompletion(
  tabId: number,
  executingUrl: string,
  executingStepIndex: number,
  ignoreSpaNavigation: boolean = false
): Promise<StepCompletionType> {
  // 清理旧的 resolver
  const existing = stepCompletionResolvers.get(tabId);
  if (existing) {
    existing.cleanup();
    existing.reject('Cancelled by new step execution');
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    const safeResolve = (type: StepCompletionType) => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(type);
      }
    };

    // 监听 MPA 导航（完整页面加载）
    const navigationCommitListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0) {
        if (details.url !== executingUrl) {
          console.log(`[Pilot Engine] MPA navigation detected: ${executingUrl} -> ${details.url}`);
        } else {
          // 同 URL 刷新：脚本操作（如表单提交、点击按钮）可能触发页面刷新而不改变 URL
          // 此时 Main World 脚本被卸载，next()/finish() 信号会丢失，需要通过导航事件检测完成
          console.log(`[Pilot Engine] Page refresh detected (same URL): ${details.url}`);
        }
        safeResolve('mpa_navigation');
      }
    };

    // 监听 SPA 路由变化（History API: pushState/replaceState）
    const historyStateListener = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      if (details.tabId === tabId && details.frameId === 0 && details.url !== executingUrl) {
        console.log(`[Pilot Engine] SPA navigation detected: ${executingUrl} -> ${details.url}`);
        safeResolve('spa_navigation');
      }
    };

    chrome.webNavigation.onCommitted.addListener(navigationCommitListener);
    // AI step 不监听 SPA 导航，只依赖 workflow.next() 信号
    if (!ignoreSpaNavigation) {
      chrome.webNavigation.onHistoryStateUpdated.addListener(historyStateListener);
    }

    const cleanup = () => {
      chrome.webNavigation.onCommitted.removeListener(navigationCommitListener);
      if (!ignoreSpaNavigation) {
        chrome.webNavigation.onHistoryStateUpdated.removeListener(historyStateListener);
      }
      stepCompletionResolvers.delete(tabId);
    };

    stepCompletionResolvers.set(tabId, {
      resolve: safeResolve,
      reject,
      cleanup,
      executingStepIndex
    });

    const waitingFor = ignoreSpaNavigation
      ? 'signal or mpa_navigation (SPA ignored)'
      : 'signal, mpa_navigation, or spa_navigation';
    console.log(`[Pilot Engine] Waiting for step completion: ${waitingFor}`);
  });
}

export function notifyWorkflowStatus(tabId: number, status: 'completed' | 'failed', error?: string, data?: any) {
  const workflow = workflows.get(tabId);
  const payload: WorkflowStatusMessage['payload'] = {
    toolCallId: workflow?.toolCallId || '',
    tabId,
    status,
    error,
    data
  };

  chrome.runtime.sendMessage({
    type: 'WORKFLOW_STATUS_UPDATE',
    payload
  }).catch(() => { });

  // Dispose PageAgent when workflow completes
  if (status === 'completed' || status === 'failed') {
    chrome.tabs.sendMessage(tabId, { type: 'DISPOSE_PAGE_AGENT' }).catch(() => {
      console.log('[Pilot Engine] Failed to dispose PageAgent (tab may be closed)');
    });
  }
}

export function stopWorkflow(tabId: number) {
  const workflow = workflows.get(tabId);
  if (!workflow) {
    console.log(`[Pilot Engine] No workflow found for Tab ${tabId} to stop`);
    return;
  }

  console.log(`[Pilot Engine] Stopping workflow in Tab ${tabId}`);

  // Update current step status to failed (if exists)
  const currentStepIndex = workflow.currentStepIndex;
  const currentStep = workflow.steps[currentStepIndex];
  if (currentStep) {
    notifyStepProgress(
      tabId,
      currentStepIndex,
      currentStep.name,
      'failed',
      { error: 'Workflow stopped by user' }
    );
  }

  // Update workflow status
  workflow.status = 'failed';

  // Notify UI
  notifyWorkflowStatus(tabId, 'failed', 'Workflow stopped by user');

  // Cleanup workflow BEFORE rejecting resolver
  // This prevents the catch block in executeCurrentStep from running
  workflows.delete(tabId);

  // Send stop signal to content script
  chrome.tabs.sendMessage(tabId, { type: 'STOP_PAGE_AGENT' }).catch(() => {
    console.log('[Pilot Engine] Failed to send stop signal to content script (tab may be closed)');
  });

  // Cleanup step completion resolver (do this LAST)
  // The reject will trigger catch block, but workflow is already deleted
  const resolver = stepCompletionResolvers.get(tabId);
  if (resolver) {
    resolver.cleanup();
    resolver.reject('Workflow stopped by user');
  }
}

function notifyStepProgress(
  tabId: number,
  stepIndex: number,
  stepName: string,
  status: 'starting' | 'running' | 'completed' | 'failed',
  details?: { url?: string; error?: string }
) {
  const workflow = workflows.get(tabId);
  if (!workflow?.toolCallId) {
    console.log(`[Pilot Engine] No toolCallId for workflow in tab ${tabId}`);
    return;
  }

  // Get instruction from step
  const step = workflow.steps[stepIndex];
  const instruction = step?.instruction;

  const payload: WorkflowProgressMessage['payload'] = {
    toolCallId: workflow.toolCallId,
    tabId,
    stepIndex,
    stepName,
    status,
    timestamp: Date.now(),
    instruction,
    ...details,
  };

  console.log(`[Pilot Engine] Sending WORKFLOW_PROGRESS:`, payload);
  chrome.runtime.sendMessage({
    type: 'WORKFLOW_PROGRESS',
    payload
  }).catch(err => {
    console.error('[Pilot Engine] Failed to send WORKFLOW_PROGRESS:', err);
  });
}

function notifyPageAgentLog(
  tabId: number,
  stepIndex: number,
  log: PageAgentLogEntry
) {
  const workflow = workflows.get(tabId);
  if (!workflow?.toolCallId) {
    console.log(`[Pilot Engine] No toolCallId for workflow in tab ${tabId}`);
    return;
  }

  const payload: PageAgentLogMessage['payload'] = {
    toolCallId: workflow.toolCallId,
    tabId,
    stepIndex,
    log
  };

  console.log(`[Pilot Engine] Sending PAGEAGENT_LOG:`, payload);
  chrome.runtime.sendMessage({
    type: 'PAGEAGENT_LOG',
    payload
  }).catch(err => {
    console.error('[Pilot Engine] Failed to send PAGEAGENT_LOG:', err);
  });
}

export async function startWorkflow(steps: WorkflowStep[], tabId: number, toolCallId?: string) {
  console.log(`[Pilot Engine] Starting workflow in Tab ${tabId} with ${steps.length} steps, toolCallId: ${toolCallId}`);

  const workflow: WorkflowContext = {
    currentStepIndex: 0,
    data: {},
    steps,
    tabId,
    status: 'running',
    toolCallId,
  };

  workflows.set(tabId, workflow);

  // 直接执行第一步，executeCurrentStep 会处理导航和就绪
  executeCurrentStep(tabId);
}

export async function prepareAndStartWorkflow(steps: WorkflowStep[], tabId: number, toolCallId?: string) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const currentUrl = tab.url;

    if (!isInjectablePage(currentUrl)) {
      // 当前页面不可注入（chrome://, about: 等）
      const firstStepUrl = steps[0]?.url;

      if (firstStepUrl && isInjectablePage(firstStepUrl)) {
        console.log(`[Pilot Engine] Current page not injectable, navigating to: ${firstStepUrl}`);
        await chrome.tabs.update(tabId, { url: firstStepUrl });
        await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
      } else {
        throw new Error('当前页面无法执行脚本，请先打开目标网页');
      }
    } else {
      // 可注入页面：确保 content script 就绪（注入或刷新）
      await ensureContentScriptReady(tabId);
      chrome.tabs.sendMessage(tabId, { type: 'RESET_AGENT' }).catch(() => { });
      console.log(`[Pilot Engine] Waiting for page ready before starting workflow...`);
      await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
    }

    console.log(`[Pilot Engine] Page ready, starting workflow`);
    startWorkflow(steps, tabId, toolCallId);
  } catch (err) {
    console.error('[Pilot Engine] Failed to prepare workflow:', err);
    const errorMsg = `准备执行失败: ${err instanceof Error ? err.message : String(err)}`;
    notifyWorkflowStatus(tabId, 'failed', errorMsg);
  }
}

async function executeCurrentStep(tabId: number) {
  const workflow = workflows.get(tabId);
  if (!workflow) {
    console.log(`[Pilot Engine] No workflow found for Tab ${tabId}`);
    return;
  }

  const { steps, currentStepIndex } = workflow;

  if (currentStepIndex >= steps.length) {
    console.log(`[Pilot Engine] All steps completed for Tab ${tabId}.`);
    workflow.status = 'completed';
    notifyWorkflowStatus(tabId, 'completed');
    workflows.delete(tabId);
    return;
  }

  const step = steps[currentStepIndex];
  console.log(`[Pilot Engine] Executing Step ${currentStepIndex + 1}: ${step.name}`);

  // Notify step starting
  notifyStepProgress(tabId, currentStepIndex, step.name, 'starting', { url: step.url });

  try {
    // ===== Phase 1: 导航（如果需要）=====
    // 注意：workflow 开始前已经确保页面就绪，所以只有导航时才需要等待
    // IMPORTANT: Only explicit "navigate" steps should trigger navigation.
    // Other steps (including AI steps) must not force-return to step.url,
    // otherwise we can jump away from the actual result page produced by previous actions.
    if (step.name === 'navigate' && step.url) {
      const currentTab = await chrome.tabs.get(tabId);
      const currentUrl = normalizeUrlForCompare(currentTab.url);
      const targetUrl = normalizeUrlForCompare(step.url);
      if (currentUrl !== targetUrl) {
        console.log(`[Pilot Engine] Navigating to: ${step.url}`);
        await chrome.tabs.update(tabId, { url: step.url });

        // 导航后等待新页面就绪
        console.log(`[Pilot Engine] Waiting for new page to be ready...`);
        await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
        console.log(`[Pilot Engine] New page ready`);
      } else {
        // URL 已匹配，不需要导航，立即完成该步骤
        console.log(`[Pilot Engine] Already at target URL, navigation step completed immediately`);
        // 短暂延迟确保 UI 有时间处理 starting 状态
        await new Promise(resolve => setTimeout(resolve, 100));
        advanceWorkflow(tabId);
        return;
      }
    }
    // 如果需要导航已完成，继续执行脚本

    // ===== Phase 2: 记录执行前 URL =====
    const beforeExecuteTab = await chrome.tabs.get(tabId);
    workflow.executingUrl = beforeExecuteTab.url;
    console.log(`[Pilot Engine] Page ready. Current URL: ${workflow.executingUrl}`);

    // ===== Phase 2.5: 如果是 AI 步骤，先创建 PageAgent =====
    if (step.isAiStep) {
      console.log(`[Pilot Engine] AI step detected, creating PageAgent on demand...`);
      await createPageAgentOnDemand(tabId);
    }

    // ===== Phase 3: 脚本安全检查 =====
    const data = workflow.data;
    const code = step.code;

    console.log(`[Pilot Engine] 📜 Code:\n${code.slice(0, 200)}...`);

    // 防御性检查：拦截非法选择器
    const illegalSelectorPatterns = [
      /:has-text\(/i,
      /:contains\(/i,
      /:text\(/i,
      />>.*["']/,
    ];

    for (const pattern of illegalSelectorPatterns) {
      if (pattern.test(code)) {
        const match = code.match(pattern);
        console.error(`[Pilot Engine] 🛡️ 检测到非法选择器: ${match?.[0]}`);
        const errorMsg = `脚本包含非法选择器: "${match?.[0] || '未知'}"\n\n浏览器 querySelector 不支持 Playwright/Cypress 伪类。\n请使用标准选择器：id、name、aria-label、role、语义标签+属性。\n\n示例：\n❌ button:has-text("分享")\n✅ button[aria-label="分享"]\n✅ #share-btn\n✅ [data-action="share"]`;

        await chrome.scripting.executeScript({
          target: { tabId },
          func: (msg: string) => alert(msg),
          args: [errorMsg]
        });

        workflow.status = 'failed';
        workflows.delete(tabId);
        return;
      }
    }

    console.log(`[Pilot Engine] ✅ 安全检查通过，开始执行...`);

    // ===== Phase 4: 执行脚本 =====
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (injectedData: Record<string, any>, injectedCode: string) => {
        console.log('[Pilot] Executing script in Main World...');

        // 注入数据到全局
        (window as any).PilotData = injectedData;

        // 直接执行（不再监听 beforeunload）
        try {
          console.log('[Pilot Script] Starting execution...');
          eval(injectedCode);
        } catch (e) {
          console.error('[Pilot Script] Execution Error:', e);
          const errorMsg = e instanceof Error ? e.message : String(e);
          if ((window as any).Pilot?.workflow?.fail) {
            (window as any).Pilot.workflow.fail(errorMsg);
          }
        }

        console.log('[Pilot] Script execution initiated');
      },
      args: [data, code],
      world: 'MAIN'
    });

    console.log(`[Pilot Engine] Script injected into Tab ${tabId}`);

    // ===== Phase 5: 等待步骤完成（事件驱动，无超时） =====
    const executingStepIndex = currentStepIndex;
    const executingUrl = workflow.executingUrl!;

    console.log(`[Pilot Engine] Waiting for step completion... (isAiStep: ${step.isAiStep || false})`);

    const completionType = await waitForStepCompletion(tabId, executingUrl, executingStepIndex, step.isAiStep || false);

    if (completionType === 'mpa_navigation') {
      // MPA 导航：等待新页面就绪后推进
      console.log(`[Pilot Engine] MPA navigation detected, waiting for new page ready...`);
      await waitForPageReady(tabId, ['PAGE_FULLY_READY'], 15000);
      console.log(`[Pilot Engine] New page ready, auto-advancing workflow`);

      // 再次检查工作流是否已被推进（防止重复推进）
      const latestWorkflow = workflows.get(tabId);
      if (latestWorkflow && latestWorkflow.currentStepIndex === executingStepIndex) {
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] Workflow already advanced by signal, skipping navigation-based advance`);
      }
    } else if (completionType === 'spa_navigation') {
      // SPA 导航：页面未重新加载，直接推进
      console.log(`[Pilot Engine] SPA navigation completed, advancing workflow`);

      const latestWorkflow = workflows.get(tabId);
      if (latestWorkflow && latestWorkflow.currentStepIndex === executingStepIndex) {
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] Workflow already advanced by signal, skipping SPA navigation-based advance`);
      }
    } else {
      // 'signal': workflow.next/finish 已经调用了 advanceWorkflow，无需额外操作
      console.log(`[Pilot Engine] Step completed by signal`);
    }

  } catch (err: any) {
    console.error('[Pilot Engine] Execution failed:', err);
    const errorMsg = err.message || String(err);

    // Check if workflow still exists (might be deleted by stopWorkflow)
    const currentWorkflow = workflows.get(tabId);
    if (!currentWorkflow) {
      console.log('[Pilot Engine] Workflow already handled by stopWorkflow, skipping error handling');
      return;
    }

    // Notify step failed
    notifyStepProgress(tabId, currentStepIndex, step.name, 'failed', { error: errorMsg });

    workflow.status = 'failed';

    // 通知 sidepanel (before delete!)
    notifyWorkflowStatus(tabId, 'failed', errorMsg);
    workflows.delete(tabId);

    // 通知用户
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (msg: string) => alert(`Pilot 执行失败：\n${msg}`),
        args: [errorMsg]
      });
    } catch (e) {
      console.error('[Pilot Engine] Failed to show error alert:', e);
    }
  }
}

function advanceWorkflow(tabId: number) {
  const workflow = workflows.get(tabId);
  if (!workflow) return;

  // Notify previous step completed (with url info)
  const prevStepIndex = workflow.currentStepIndex;
  const prevStep = workflow.steps[prevStepIndex];
  if (prevStep) {
    notifyStepProgress(tabId, prevStepIndex, prevStep.name, 'completed', { url: prevStep.url });
  }

  workflow.currentStepIndex++;
  const { steps, currentStepIndex } = workflow;

  if (currentStepIndex >= steps.length) {
    console.log(`[Pilot Engine] Workflow Completed in Tab ${tabId}! 🚀`);
    workflow.status = 'completed';
    notifyWorkflowStatus(tabId, 'completed');
    workflows.delete(tabId);
    return;
  }

  const nextStep = steps[currentStepIndex];
  console.log(`[Pilot Engine] Advancing to Step ${currentStepIndex + 1}: ${nextStep.name}`);

  // 直接调用 executeCurrentStep，它会处理导航和就绪等待
  executeCurrentStep(tabId);
}

const globalStore: Record<string, any> = {};

export function handleBridgeAction(action: string, payload: any, sender: chrome.runtime.MessageSender) {
  const tabId = sender.tab?.id;
  if (!tabId) {
    console.log('[Pilot BG] No tabId in sender');
    return;
  }

  console.log(`[Pilot BG] Bridge Action [Tab ${tabId}]:`, action, payload);

  switch (action) {
    case 'openTab':
      chrome.tabs.create({ url: payload.url });
      break;
    case 'setData':
      globalStore[payload.key] = payload.value;
      break;
    case 'workflowNext':
      const workflow = workflows.get(tabId);
      if (workflow && workflow.status === 'running') {
        if (payload.data) {
          workflow.data = { ...workflow.data, ...payload.data };
        }
        console.log(`[Pilot Engine] Step finished in Tab ${tabId}. Data:`, workflow.data);

        // 通知 waitForStepCompletion
        const resolver = stepCompletionResolvers.get(tabId);
        if (resolver) {
          resolver.resolve('signal');
          resolver.cleanup();
        }

        // 推进到下一步
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] No running workflow for Tab ${tabId}`);
      }
      break;
    case 'workflowFinish':
      const wf = workflows.get(tabId);
      if (wf) {
        // 通知 waitForStepCompletion
        const resolver = stepCompletionResolvers.get(tabId);
        if (resolver) {
          resolver.resolve('signal');
          resolver.cleanup();
        }

        // Notify current step completed
        const currentStep = wf.steps[wf.currentStepIndex];
        if (currentStep) {
          notifyStepProgress(tabId, wf.currentStepIndex, currentStep.name, 'completed', { url: currentStep.url });
        }

        wf.status = 'completed';
        console.log(`[Pilot Engine] Workflow finished manually in Tab ${tabId}.`, payload.data);

        // 通知 sidepanel (before delete!)
        notifyWorkflowStatus(tabId, 'completed', undefined, payload.data);
        workflows.delete(tabId);
      }
      break;
    case 'workflowFail':
      const failedWf = workflows.get(tabId);
      if (failedWf) {
        // 清理 step completion resolver
        const resolver = stepCompletionResolvers.get(tabId);
        if (resolver) {
          resolver.cleanup();
          stepCompletionResolvers.delete(tabId);
        }

        const stepIndex = failedWf.currentStepIndex;
        const failedStep = failedWf.steps[stepIndex];
        const stepName = failedStep?.name || 'Unknown';
        const errorMsg = `步骤 "${stepName}" 失败: ${payload.reason}`;

        // Notify step failed
        notifyStepProgress(tabId, stepIndex, stepName, 'failed', { error: payload.reason });

        failedWf.status = 'failed';
        console.error(`[Pilot Engine] ❌ Workflow FAILED at Step "${stepName}": ${payload.reason}`);

        // 通知 sidepanel (before delete!)
        notifyWorkflowStatus(tabId, 'failed', errorMsg);
        workflows.delete(tabId);

        // Notify user via alert in the tab
        chrome.scripting.executeScript({
          target: { tabId },
          func: (reason: string, step: string) => {
            alert(`Pilot Workflow 失败！\n\n步骤: ${step}\n原因: ${reason}`);
          },
          args: [payload.reason, stepName]
        });
      }
      break;
  }
}

