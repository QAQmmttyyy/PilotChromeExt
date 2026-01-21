import { tool } from 'ai';
import { z } from 'zod';

// Client-side tool: no execute function
// Frontend will handle via onToolCall
export const executeWorkflowTool = tool({
  description: `通知客户端在浏览器中执行生成的脚本。
当脚本准备好且用户明确确认要执行时调用此工具。
这会触发浏览器端的 workflow 执行。`,
  inputSchema: z.object({
    script: z.string().describe('要执行的 JavaScript 脚本'),
  }),
  // No execute function - this is a client-side tool
});

