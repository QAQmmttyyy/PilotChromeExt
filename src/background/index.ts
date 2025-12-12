import { WorkflowContext, WorkflowStep } from '../lib/types';

console.log('Pilot background script loaded');

const globalStore: Record<string, any> = {};
const workflows = new Map<number, WorkflowContext>();

chrome.runtime.onMessage.addListener((request, sender) => {
  console.log('[Pilot BG] Received message:', request.type);
  
  if (request.type === 'PILOT_BRIDGE_ACTION') {
    handleBridgeAction(request.action, request.payload, sender);
  } else if (request.type === 'START_WORKFLOW') {
    const { steps, tabId } = request.payload;
    startWorkflow(steps, tabId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const workflow = workflows.get(tabId);
  if (workflow && workflow.status === 'running') {
    if (changeInfo.status === 'complete') {
      console.log(`[Pilot Engine] Tab ${tabId} loaded. Executing step...`);
      executeCurrentStep(tabId);
    }
  }
});

function handleBridgeAction(action: string, payload: any, sender: chrome.runtime.MessageSender) {
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
        advanceWorkflow(tabId);
      } else {
        console.log(`[Pilot Engine] No running workflow for Tab ${tabId}`);
      }
      break;
    case 'workflowFinish':
      const wf = workflows.get(tabId);
      if (wf) {
        wf.status = 'completed';
        workflows.delete(tabId);
        console.log(`[Pilot Engine] Workflow finished manually in Tab ${tabId}.`);
      }
      break;
    case 'workflowFail':
      const failedWf = workflows.get(tabId);
      if (failedWf) {
        failedWf.status = 'failed';
        workflows.delete(tabId);
        const stepName = failedWf.steps[failedWf.currentStepIndex]?.name || 'Unknown';
        console.error(`[Pilot Engine] ❌ Workflow FAILED at Step "${stepName}": ${payload.reason}`);
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

async function startWorkflow(steps: WorkflowStep[], tabId: number) {
  console.log(`[Pilot Engine] Starting workflow in Tab ${tabId} with ${steps.length} steps`);
  
  const workflow: WorkflowContext = {
    currentStepIndex: 0,
    data: {},
    steps,
    tabId,
    status: 'running'
  };
  
  workflows.set(tabId, workflow);

  const firstStep = steps[0];
  if (firstStep.url) {
     console.log(`[Pilot Engine] First step requires navigation to: ${firstStep.url}`);
     chrome.tabs.update(tabId, { url: firstStep.url });
  } else {
     console.log(`[Pilot Engine] First step has no URL, executing directly`);
     executeCurrentStep(tabId);
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
    workflows.delete(tabId);
    return;
  }

  const step = steps[currentStepIndex];
  console.log(`[Pilot Engine] Executing Step ${currentStepIndex + 1}: ${step.name}`);

  try {
     const data = workflow.data;
     const code = step.code;

     // 使用 Main World 执行 (使用 script 标签注入)
     // 大多数网站的 Main World 允许 inline script
     await chrome.scripting.executeScript({
       target: { tabId },
       func: (injectedData, injectedCode) => {
          console.log('[Pilot] Injecting script in Main World...');
          
          // 1. 先注入数据
          // @ts-ignore
          window.PilotData = injectedData;
          
          // 2. 使用 script 标签注入代码
          const script = document.createElement('script');
          script.textContent = `
            (function() {
              console.log('[Pilot Script] Starting execution...');
              try {
                ${injectedCode}
              } catch(e) {
                console.error('[Pilot Script] Error:', e);
              }
            })();
          `;
          (document.head || document.documentElement).appendChild(script);
          script.remove();
          
          console.log('[Pilot] Script injected');
       },
       args: [data, code],
       world: 'MAIN'
     });
     
     console.log(`[Pilot Engine] Script injection completed for Tab ${tabId}`);

  } catch (err) {
    console.error('[Pilot Engine] Execution failed:', err);
    workflows.delete(tabId);
  }
}

function advanceWorkflow(tabId: number) {
  const workflow = workflows.get(tabId);
  if (!workflow) return;

  workflow.currentStepIndex++;
  const { steps, currentStepIndex } = workflow;

  if (currentStepIndex >= steps.length) {
    console.log(`[Pilot Engine] Workflow Completed in Tab ${tabId}! 🚀`);
    workflow.status = 'completed';
    workflows.delete(tabId);
    return;
  }

  const nextStep = steps[currentStepIndex];
  if (nextStep.url) {
    console.log(`[Pilot Engine] Step ${currentStepIndex + 1} requires navigation to: ${nextStep.url}`);
    chrome.tabs.update(tabId, { url: nextStep.url });
  } else {
    executeCurrentStep(tabId);
  }
}
