import { tool, generateObject } from 'ai';
import { z } from 'zod';
import { STEPS_GENERATION_PROMPT } from '../prompts';
import { getModel } from '../../lib/config';

const StepSchema = z.object({
  type: z.enum(['navigate', 'ai_step']).describe('步骤类型：navigate 为导航，ai_step 为 AI 操作'),
  url: z.string().optional().describe('导航目标 URL，navigate 类型必填'),
  value: z.string().optional().describe('操作指令描述，ai_step 类型必填'),
});

const StepsResponseSchema = z.object({
  steps: z.array(StepSchema).describe('网页任务的步骤序列'),
});

export const generateStepsTool = tool({
  description: `将用户的任务分解为可执行的步骤序列。
当用户描述一个浏览器任务时调用此工具。
步骤类型包括：navigate（导航到URL）、ai_step（AI执行的操作如点击、输入等）。
返回结构化的步骤列表供用户确认。`,
  inputSchema: z.object({
    task: z.string().describe('用户描述的任务'),
  }),
  execute: async ({ task }) => {
    try {
      console.log('[generateSteps] Starting with task:', task);
      
      const { object } = await generateObject({
        model: getModel(),
        schema: StepsResponseSchema,
        system: STEPS_GENERATION_PROMPT,
        prompt: task,
      });

      console.log('[generateSteps] Generated object:', JSON.stringify(object, null, 2));

      const steps = object.steps.map((step, index) => ({
        id: `step-${index + 1}`,
        timestamp: Date.now(),
        type: step.type as 'navigate' | 'ai_step',
        url: step.url || '',
        pageTitle: step.type === 'navigate' ? `导航到 ${step.url}` : (step.value || ''),
        value: step.value,
      }));

      return {
        success: true,
        steps,
      };
    } catch (error) {
      console.error('[generateSteps] Error:', error);
      const errorMessage = error instanceof Error 
        ? `${error.name}: ${error.message}` 
        : 'Unknown error';
      return {
        success: false,
        steps: [],
        error: errorMessage,
      };
    }
  },
});
