import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { getModel } from '../lib/config';
import {
  pageActionTool,
  createTabTool,
  updateTabTool,
  closeTabTool,
  getTabTool,
  queryTabsTool,
  captureScreenshotTool,
} from './tools';
import { REACT_AGENT_SYSTEM_PROMPT } from './prompts';

export async function streamAgentResponse(messages: UIMessage[]) {
  const modelMessages = convertToModelMessages(messages);
  
  return streamText({
    model: getModel(),
    system: REACT_AGENT_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: {
      page_action: pageActionTool,
      create_tab: createTabTool,
      update_tab: updateTabTool,
      close_tab: closeTabTool,
      get_tab: getTabTool,
      query_tabs: queryTabsTool,
      capture_screenshot: captureScreenshotTool,
    },
    stopWhen: stepCountIs(100),
    onChunk: ({ chunk }) => {
      console.log('[Stream Chunk]', chunk.type, JSON.stringify(chunk, null, 2));
    },
    onError: ({ error }) => {
      console.error('[Agent] Stream error:', error);
    },
    onStepFinish: async ({ toolCalls, finishReason, response }) => {
      console.log('[Agent] Step finished:', {
        finishReason,
        toolCallsCount: toolCalls?.length || 0,
        toolNames: toolCalls?.map(tc => tc.toolName),
      });
      if (toolCalls && toolCalls.length > 0) {
        toolCalls.forEach((tc, idx) => {
          console.log(`[Agent] Tool call ${idx + 1}:`, {
            name: tc.toolName,
            input: JSON.stringify(tc),
          });
        });
      }
    },
    onFinish: ({ finishReason, usage, response }) => {
      console.log('[Agent] Stream finished:', JSON.stringify({
        finishReason,
        usage,
        responseId: response?.id,
      }, null, 2));
    },
  });
}
