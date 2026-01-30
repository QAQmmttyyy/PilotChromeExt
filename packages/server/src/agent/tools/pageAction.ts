import { tool } from 'ai';
import { z } from 'zod';

export const pageActionTool = tool({
  description: `Execute an action on a specific tab, handled by the PageAgent in the web page. (Note: Cannot perform cross-page operations, must be within a single page)`,
  inputSchema: z.object({
    tabId: z.number().describe('The tab ID where the action should be executed'),
    instruction: z.string().describe('The instruction to execute, using natural language. Must be a single-page operation, cannot cross pages. E.g., "Click login button", "Type hello in search box"'),
  }),
  // Client-side tool: no execute function
  // Frontend will handle via usePageAction hook
});
