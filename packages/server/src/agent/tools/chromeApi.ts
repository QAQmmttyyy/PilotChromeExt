import { tool } from 'ai';
import { z } from 'zod';

export const createTabTool = tool({
  description: 'Create a new browser tab',
  inputSchema: z.object({
    url: z.string().optional().describe('The URL to open. If not provided, opens a blank tab.'),
    active: z.boolean().optional().describe('Whether to activate the new tab. Defaults to true. Must be a boolean (true/false).'),
  }),
});

export const updateTabTool = tool({
  description: 'Update a tab (navigate to a new URL or activate it). If tabId is not specified, updates the current active tab.',
  inputSchema: z.object({
    url: z.string().optional().describe('The URL to navigate to.'),
    tabId: z.number().optional().describe('The target tab ID. If not provided, uses the current active tab.'),
    active: z.boolean().optional().describe('Whether to activate the tab. Must be a boolean (true/false).'),
  }),
});

export const closeTabTool = tool({
  description: 'Close a specific tab',
  inputSchema: z.object({
    tabId: z.number().describe('The ID of the tab to close'),
  }),
});

export const getTabTool = tool({
  description: 'Get information about a tab. If tabId is not specified, gets the current active tab.',
  inputSchema: z.object({
    tabId: z.number().optional().describe('The tab ID. If not provided, gets the current active tab.'),
  }),
});

export const queryTabsTool = tool({
  description: 'Query for tabs matching specific criteria',
  inputSchema: z.object({
    active: z.boolean().optional().describe('Whether to query only active tabs. Must be a boolean (true/false).'),
    currentWindow: z.boolean().optional().describe('Whether to query only tabs in the current window.'),
  }),
});

export const captureScreenshotTool = tool({
  description: 'Capture a screenshot of the visible area of the tab',
  inputSchema: z.object({
    tabId: z.number().optional().describe('The target tab ID. If not provided, captures the current active tab.'),
  }),
});
