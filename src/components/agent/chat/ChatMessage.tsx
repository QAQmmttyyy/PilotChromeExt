import type { UIMessage } from '@ai-sdk/react';
import { Message, MessageContent } from '@/components/ui/message';
import { Tool } from '@/components/ui/tool';
import { isToolPart, adaptToolPart } from './utils';

interface ChatMessageProps {
  message: UIMessage;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Message className="justify-end">
        {message.parts?.map((part: any, idx: number) => {
          if (part.type === 'text') {
            return (
              <MessageContent
                key={idx}
                className="bg-primary text-primary-foreground max-h-[240px] overflow-y-auto"
              >
                {part.text}
              </MessageContent>
            );
          }
          return null;
        })}
      </Message>
    );
  }

  return (
    <Message>
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        {message.parts?.map((part: any, idx: number) => {
          if (part.type === 'text') {
            return (
              <MessageContent
                key={idx}
                markdown
                className="bg-transparent"
              >
                {part.text}
              </MessageContent>
            );
          }
          if (isToolPart(part)) {
            return (
              <Tool
                key={idx}
                toolPart={adaptToolPart(part)}
                defaultOpen={isStreaming}
              />
            );
          }
          return null;
        })}
      </div>
    </Message>
  );
}

