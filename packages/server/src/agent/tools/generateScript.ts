import { tool, generateText } from 'ai';
import { z } from 'zod';
import type { GenerateScriptOutput } from '@pilot/shared';
import { SCRIPT_GENERATION_PROMPT } from '../prompts';
import { cleanGeneratedCode } from '../../lib/utils';
import { getModel } from '../../lib/config';

const RecordedStepSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum(['click', 'input', 'navigate', 'submit', 'select', 'keypress', 'ai_step']),
  url: z.string(),
  pageTitle: z.string(),
  value: z.string().optional(),
});

export const generateScriptTool = tool({
  description: `Generate executable JavaScript script based on the sequence of steps.
Called when the user confirms the steps are correct after step generation.
The generated script will be executed in the browser.`,
  inputSchema: z.object({
    steps: z.array(RecordedStepSchema).describe('Sequence of steps'),
  }),
  execute: async ({ steps }): Promise<GenerateScriptOutput> => {
    try {
      const stepsJson = JSON.stringify(steps.map(s => ({
        type: s.type,
        url: s.url || undefined,
        value: s.value || undefined,
      })), null, 2);

      const { text } = await generateText({
        model: getModel(),
        system: SCRIPT_GENERATION_PROMPT,
        prompt: `Please generate a script based on the following steps:\n\n${stepsJson}`,
      });

      const script = cleanGeneratedCode(text);

      return {
        success: true,
        script,
      };
    } catch (error) {
      return {
        success: false,
        script: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  },
});
