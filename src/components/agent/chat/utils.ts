import type { UIMessage } from '@ai-sdk/react';
import type { ToolPart } from '@/components/ui/tool';

export function isToolPart(part: any): boolean {
  return part.toolCallId || part.type?.startsWith('tool-');
}

export function adaptToolPart(part: any): ToolPart {
  const { toolName, toolCallId, input, output, state } = part;
  
  let toolState: ToolPart['state'] = 'input-streaming';
  if (state === 'input-available') toolState = 'input-available';
  if (state === 'output-available') toolState = 'output-available';
  if (state === 'output-error') toolState = 'output-error';
  if (state === 'approval-requested') toolState = 'input-available';
  
  const name = toolName || (part.type?.startsWith('tool-') ? part.type.substring(5) : 'unknown');

  return {
    type: name,
    toolName: toolName, // Pass through toolName for special handling
    state: toolState,
    input: input,
    output: output,
    toolCallId: toolCallId,
  };
}

export function extractExecutedToolIds(messages: UIMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.parts) continue;
    for (const part of msg.parts as any[]) {
      if (isToolPart(part) && part.toolCallId) {
        ids.add(part.toolCallId);
      }
    }
  }
  return ids;
}

