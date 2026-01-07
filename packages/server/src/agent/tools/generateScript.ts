import { tool, generateText } from 'ai';
import { z } from 'zod';
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
  description: `根据步骤序列生成可执行的 JavaScript 脚本。
在步骤生成完成后，用户确认步骤正确时调用此工具。
生成的脚本将在浏览器中执行。`,
  inputSchema: z.object({
    steps: z.array(RecordedStepSchema).describe('步骤序列'),
  }),
  execute: async ({ steps }) => {
    try {
      const stepsJson = JSON.stringify(steps.map(s => ({
        type: s.type,
        url: s.url || undefined,
        value: s.value || undefined,
      })), null, 2);

      const { text } = await generateText({
        model: getModel(),
        system: SCRIPT_GENERATION_PROMPT,
        prompt: `请根据以下步骤生成脚本：\n\n${stepsJson}`,
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
