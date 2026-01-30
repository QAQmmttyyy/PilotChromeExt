import type { UIMessage } from '@ai-sdk/react';
import { isToolOrDynamicToolUIPart } from 'ai';

export function extractExecutedToolIds(messages: UIMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.parts) continue;
    for (const part of msg.parts) {
      if (isToolOrDynamicToolUIPart(part)) {
        ids.add(part.toolCallId);
      }
    }
  }
  return ids;
}
