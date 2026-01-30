import { tool } from 'ai';
import { z } from 'zod';

export const pageActionTool = tool({
  description: `在指定标签页执行操作，由网页端 PageAgent 托管执行。（注意：不能跨页面操作，必须是单页面内的操作）`,
  inputSchema: z.object({
    tabId: z.number().describe('要在哪个标签页执行操作'),
    instruction: z.string().describe('要执行的操作指令，使用自然语言描述，必须是单页面内的操作，不能跨页面操作，如"点击登录按钮"、"在搜索框输入 hello"'),
  }),
  // Client-side tool: no execute function
  // Frontend will handle via usePageAction hook
});
