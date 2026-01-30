import { tool } from 'ai';
import { z } from 'zod';

export const createTabTool = tool({
  description: '创建新的浏览器标签页',
  inputSchema: z.object({
    url: z.string().optional().describe('要打开的 URL，不填则打开空白页'),
    active: z.boolean().optional().describe('是否激活新标签页，默认为 true。必须是 boolean 类型 (true/false)，严禁使用字符串'),
  }),
});

export const updateTabTool = tool({
  description: '更新标签页（导航到新 URL 或激活标签页）。如果不指定 tabId，则更新当前活动标签页',
  inputSchema: z.object({
    url: z.string().optional().describe('要导航到的 URL'),
    tabId: z.number().optional().describe('目标标签页 ID，不填则使用当前活动标签页'),
    active: z.boolean().optional().describe('是否激活标签页。必须是 boolean 类型 (true/false)，严禁使用字符串'),
  }),
});

export const closeTabTool = tool({
  description: '关闭指定的标签页',
  inputSchema: z.object({
    tabId: z.number().describe('要关闭的标签页 ID'),
  }),
});

export const getTabTool = tool({
  description: '获取标签页信息。如果不指定 tabId，则获取当前活动标签页',
  inputSchema: z.object({
    tabId: z.number().optional().describe('标签页 ID，不填则获取当前活动标签页'),
  }),
});

export const queryTabsTool = tool({
  description: '查询符合条件的标签页列表',
  inputSchema: z.object({
    active: z.boolean().optional().describe('是否只查询活动标签页。必须是 boolean 类型 (true/false)，严禁使用字符串'),
    currentWindow: z.boolean().optional().describe('是否只查询当前窗口的标签页'),
  }),
});

export const captureScreenshotTool = tool({
  description: '截取标签页的可见区域截图',
  inputSchema: z.object({
    tabId: z.number().optional().describe('目标标签页 ID，不填则截取当前活动标签页'),
  }),
});
