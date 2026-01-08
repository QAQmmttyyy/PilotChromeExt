import { useEffect, useState, useMemo } from 'react';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Loader2 } from 'lucide-react';
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container';
import { ScrollButton } from '@/components/ui/scroll-button';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useWorkflowExecution } from './useWorkflowExecution';

export interface ChatProps {
  chatId: string;
  isNewChat: boolean;
  serverUrl: string;
  initialMessages: UIMessage[];
  onConversationCreated?: (id: string) => void;
}

export function Chat({ chatId, isNewChat, serverUrl, initialMessages, onConversationCreated }: ChatProps) {
  const [input, setInput] = useState('');

  const transport = useMemo(() => new DefaultChatTransport({
    api: `${serverUrl}/api/chat`,
    prepareSendMessagesRequest({ messages }) {
      return { body: { message: messages[messages.length - 1], id: chatId } };
    },
  }), [serverUrl, chatId]);

  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const isLoading = status === 'streaming' || status === 'submitted';

  useEffect(() => {
    if (isNewChat && status === 'streaming') {
      onConversationCreated?.(chatId);
    }
  }, [status, isNewChat, chatId, onConversationCreated]);

  useWorkflowExecution(messages, initialMessages);

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] });
    setInput('');
  };

  return (
    <div className="flex flex-col h-full relative bg-slate-50">
      {error && (
        <div className="absolute top-0 left-0 right-0 z-10 p-2 bg-red-50 text-red-600 text-xs border-b border-red-100">
          Error: {error.message}
        </div>
      )}

      <ChatContainerRoot className="flex-1 overflow-hidden">
        <ChatContainerContent className="p-4 space-y-6">
          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex items-center gap-2 text-slate-400 text-xs px-12">
              <Loader2 size={12} className="animate-spin" />
              <span>思考中...</span>
            </div>
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
        <ScrollButton className="absolute right-4 bottom-20" />
      </ChatContainerRoot>

      <ChatInput 
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
      />
    </div>
  );
}

