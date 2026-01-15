import { WorkflowStep } from './types';

/**
 * Parses a single JS file into a list of WorkflowStep objects.
 * 
 * 格式:
 * // 前置代码（工具函数等），会被附加到每个步骤
 * function helper() { ... }
 * 
 * // === STEP: Step Name (https://optional-url.com) ===
 * code...
 * 
 * // === STEP: Next Step ===
 * code...
 */
export function parseScriptToWorkflow(scriptCode: string): WorkflowStep[] {
  const stepRegex = /\/\/ === STEP:\s*(.*?)(?:\s*\((https?:\/\/[^)]+)\))?\s*===/g;
  const steps: WorkflowStep[] = [];
  
  let match;
  let lastIndex = 0;
  let currentStep: Partial<WorkflowStep> | null = null;
  let currentStepHeaderUrl: string | undefined;
  let preamble = ''; // 前置代码（第一个 STEP 之前的代码）

  // 如果没有找到任何标记，这就只是一个普通脚本
  const firstMatch = stepRegex.exec(scriptCode);
  if (!firstMatch) {
    return [{
      id: 'single-step',
      name: 'Main Script',
      code: scriptCode
    }];
  }

  // 提取前置代码（第一个 STEP 之前的所有代码）
  preamble = scriptCode.substring(0, firstMatch.index).trim();
  
  // 重置 regex（因为上面 exec 消耗了一次）
  stepRegex.lastIndex = 0;

  while ((match = stepRegex.exec(scriptCode)) !== null) {
    // 1. 处理上一个步骤的代码
    if (currentStep) {
      const stepCode = scriptCode.substring(lastIndex, match.index).trim();
      // 将前置代码附加到步骤代码前（如果有）
      currentStep.code = preamble ? `${preamble}\n\n${stepCode}` : stepCode;
      const isAiStep = stepCode.includes('pageAgent.execute');
      currentStep.isAiStep = isAiStep;
      // Only "navigate" steps should carry url, other steps keep current page.
      if (!isAiStep && currentStep.name === 'navigate') {
        currentStep.url = currentStepHeaderUrl;
      } else {
        currentStep.url = undefined;
      }
      steps.push(currentStep as WorkflowStep);
    }

    // 2. 开启新步骤
    const name = match[1].trim();
    const url = match[2]; // Capturing group 2 is the URL inside parens
    currentStepHeaderUrl = url;

    currentStep = {
      id: `step-${steps.length + 1}`,
      name,
      url: undefined,
      code: ''
    };
    
    lastIndex = stepRegex.lastIndex;
  }

  // 处理最后一个步骤
  if (currentStep) {
    const stepCode = scriptCode.substring(lastIndex).trim();
    currentStep.code = preamble ? `${preamble}\n\n${stepCode}` : stepCode;
    const isAiStep = stepCode.includes('pageAgent.execute');
    currentStep.isAiStep = isAiStep;
    if (!isAiStep && currentStep.name === 'navigate') {
      currentStep.url = currentStepHeaderUrl;
    } else {
      currentStep.url = undefined;
    }
    steps.push(currentStep as WorkflowStep);
  }

  return steps;
}
