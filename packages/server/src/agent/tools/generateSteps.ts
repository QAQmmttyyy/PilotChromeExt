import { tool, generateObject } from 'ai';
import { z } from 'zod';
import type { GenerateStepsOutput } from '@pilot/shared';
import { STEPS_GENERATION_PROMPT } from '../prompts';
import { getModel } from '../../lib/config';

const StepSchema = z.object({
  type: z.enum(['navigate', 'ai_step']).describe('Step type: navigate for navigation, ai_step for AI operation'),
  url: z.string().optional().describe('Target URL for navigation, required for navigate type'),
  value: z.string().optional().describe('Operation instruction description, required for ai_step type'),
});

const StepsResponseSchema = z.object({
  steps: z.array(StepSchema).describe('Sequence of steps for the web task'),
});

export const generateStepsTool = tool({
  description: `Decompose the user's task into an executable sequence of steps.
Called when the user describes a browser task.
Step types include: navigate (navigate to URL), ai_step (AI executed operations like click, input, etc.).
Returns a structured list of steps for user confirmation.`,
  inputSchema: z.object({
    task: z.string().describe('The task described by the user'),
  }),
  execute: async ({ task }): Promise<GenerateStepsOutput> => {
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
        pageTitle: step.type === 'navigate' ? `Navigate to ${step.url}` : (step.value || ''),
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
