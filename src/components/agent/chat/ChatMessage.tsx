import type { UIMessage } from '@ai-sdk/react';
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message';
import { Tool } from '@/components/ui/tool';
import { isToolPart, adaptToolPart } from './utils';

interface ChatMessageProps {
  message: UIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <Message className={isUser ? 'flex-row-reverse' : ''}>
      <MessageAvatar 
        src={isUser ? '' : '/icon-128.png'}
        alt={message.role}
        className={isUser ? 'bg-blue-100 text-blue-600' : 'bg-white border border-slate-200'}
        fallback={isUser ? 'U' : 'AI'}
      />
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {message.parts && message.parts.map((part: any, idx: number) => {
          if (part.type === 'text') {
            return (
              <MessageContent 
                key={idx}
                markdown 
                className={`text-sm p-3 rounded-xl ${
                  isUser 
                    ? 'bg-blue-500 text-white rounded-br-sm' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
                }`}
              >
                {part.text}
              </MessageContent>
            );
          }
          if (isToolPart(part)) {
            return (
              <div key={idx} className="w-full">
                <Tool 
                  toolPart={adaptToolPart(part)} 
                  className="bg-white border border-slate-200 rounded-lg shadow-sm"
                />
              </div>
            );
          }
          return null;
        })}
      </div>
    </Message>
  );
}

