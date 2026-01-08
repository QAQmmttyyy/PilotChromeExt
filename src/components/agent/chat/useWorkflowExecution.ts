import { useEffect, useState } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { isToolPart, extractExecutedToolIds } from './utils';

export function useWorkflowExecution(messages: UIMessage[], initialMessages: UIMessage[]) {
  const [executedToolIds, setExecutedToolIds] = useState<Set<string>>(
    () => extractExecutedToolIds(initialMessages)
  );

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.parts) {
      lastMsg.parts.forEach(async (part: any) => {
        if (!isToolPart(part)) return;
        
        const toolName = part.toolName || (part.type?.startsWith('tool-') ? part.type.substring(5) : '');
        if (toolName !== 'executeWorkflow' || part.state !== 'output-available') return;
        if (executedToolIds.has(part.toolCallId)) return;
        
        setExecutedToolIds(prev => new Set(prev).add(part.toolCallId));
        
        const result = part.output as { script?: string };
        if (!result?.script) return;
        
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            await chrome.runtime.sendMessage({
              type: 'START_WORKFLOW',
              payload: { script: result.script, tabId: tab.id }
            });
          }
        } catch (err) {
          console.error('Failed to execute workflow:', err);
        }
      });
    }
  }, [messages, executedToolIds]);
}

