import { tool, generateText } from 'ai';
import { z } from 'zod';
import { STEPS_GENERATION_PROMPT } from '../prompts';
import { getModel } from '../../lib/config';

const StepSchema = z.object({
  type: z.enum(['navigate', 'ai_step']),
  url: z.string().optional(),
  value: z.string().optional(),
});

const StepsArraySchema = z.array(StepSchema);

export const generateStepsTool = tool({
  description: `将用户的自动化任务分解为可执行的步骤序列。
当用户描述一个浏览器自动化任务时调用此工具。
步骤类型包括：navigate（导航到URL）、ai_step（AI执行的操作如点击、输入等）。
返回结构化的步骤列表供用户确认。`,
  inputSchema: z.object({
    task: z.string().describe('用户描述的自动化任务'),
  }),
  execute: async ({ task }) => {
    try {
      const { text } = await generateText({
        model: getModel(),
        system: STEPS_GENERATION_PROMPT,
        prompt: task,
      });

      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return {
          success: false,
          steps: [],
          error: 'AI 未返回有效的步骤 JSON',
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const validated = StepsArraySchema.parse(parsed);

      const steps = validated.map((step, index) => ({
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
      return {
        success: false,
        steps: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
