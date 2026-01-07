import { streamText, stepCountIs, tool, convertToModelMessages, type UIMessage } from 'ai';
import { getModel } from '../lib/config';
import { generateStepsTool, generateScriptTool, executeWorkflowTool } from './tools';
import { AGENT_SYSTEM_PROMPT } from './prompts';

const tools = {
  generateSteps: generateStepsTool,
  generateScript: generateScriptTool,
  executeWorkflow: executeWorkflowTool,
};

export async function streamAgentResponse(messages: UIMessage[]) {
  const modelMessages = convertToModelMessages(messages);
  console.log('[Agent] Input messages count:', modelMessages.length);
  console.log('[Agent] Input messages:', JSON.stringify(modelMessages, null, 2).slice(0, 3000));
  console.log('[Agent] System prompt length:', AGENT_SYSTEM_PROMPT.length);
  
  const result = streamText({
    model: getModel(),
    system: AGENT_SYSTEM_PROMPT,
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(10),
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

  return result;
}

export { tools };
