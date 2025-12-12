import { WorkflowStep } from './types';

/**
 * Parses a single JS file into a list of WorkflowStep objects.
 * Format:
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

  // 如果没有找到任何标记，这就只是一个普通脚本
  if (scriptCode.search(stepRegex) === -1) {
    return [{
      id: 'single-step',
      name: 'Main Script',
      code: scriptCode
    }];
  }

  while ((match = stepRegex.exec(scriptCode)) !== null) {
    // 1. 处理上一个步骤的代码
    if (currentStep) {
      currentStep.code = scriptCode.substring(lastIndex, match.index).trim();
      steps.push(currentStep as WorkflowStep);
    }

    // 2. 开启新步骤
    const name = match[1].trim();
    const url = match[2]; // Capturing group 2 is the URL inside parens

    currentStep = {
      id: `step-${steps.length + 1}`,
      name,
      url,
      code: '' // Will be filled in next iteration or end
    };
    
    lastIndex = stepRegex.lastIndex;
  }

  // 处理最后一个步骤
  if (currentStep) {
    currentStep.code = scriptCode.substring(lastIndex).trim();
    steps.push(currentStep as WorkflowStep);
  }

  return steps;
}

