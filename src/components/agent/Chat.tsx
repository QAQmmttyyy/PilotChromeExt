import { useEffect, useState, useMemo } from 'react';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, Loader2 } from 'lucide-react';
import {
  ChatContainerRoot,
  ChatContainerContent,
  ChatContainerScrollAnchor,
} from '@/components/ui/chat-container';
import { ScrollButton } from '@/components/ui/scroll-button';
import {
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/message';
import { Tool, type ToolPart } from '@/components/ui/tool';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from '@/components/ui/prompt-input';

export interface ChatProps {
  chatId: string;
  isNewChat: boolean;
  serverUrl: string;
  initialMessages: UIMessage[];
  onConversationCreated?: (id: string) => void;
}

function adaptToolPart(part: any): ToolPart {
  const { toolName, toolCallId, input, output, state } = part;
  
  let toolState: ToolPart['state'] = 'input-streaming';
  if (state === 'input-available') toolState = 'input-available';
  if (state === 'output-available') toolState = 'output-available';
  if (state === 'output-error') toolState = 'output-error';
  if (state === 'approval-requested') toolState = 'input-available';
  
  const name = toolName || (part.type?.startsWith('tool-') ? part.type.substring(5) : 'unknown');

  return {
    type: name,
    state: toolState,
    input: input,
    output: output,
    toolCallId: toolCallId,
  };
}

function isToolPart(part: any): boolean {
  return part.toolCallId || part.type?.startsWith('tool-');
}

export function Chat({ chatId, isNewChat, serverUrl, initialMessages, onConversationCreated }: ChatProps) {
  const [input, setInput] = useState('');
  const [executedToolIds, setExecutedToolIds] = useState<Set<string>>(new Set());

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

  const handleSubmit = () => {
    if (!input.trim() || isLoading) return;
    sendMessage({ role: 'user', parts: [{ type: 'text', text: input }] });
    setInput('');
  };

  const renderToolPart = (part: any, idx: number) => {
    return (
      <div key={idx} className="w-full">
        <Tool 
          toolPart={adaptToolPart(part)} 
          className="bg-white border border-slate-200 rounded-lg shadow-sm"
        />
      </div>
    );
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
            <Message key={m.id} className={m.role === 'user' ? 'flex-row-reverse' : ''}>
              <MessageAvatar 
                src={m.role === 'user' ? '' : '/icon-128.png'}
                alt={m.role}
                className={m.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-white border border-slate-200'}
                fallback={m.role === 'user' ? 'U' : 'AI'}
              />
              <div className={`flex flex-col gap-2 max-w-[85%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {m.parts && m.parts.map((part: any, idx: number) => {
                  if (part.type === 'text') {
                    return (
                      <MessageContent 
                        key={idx}
                        markdown 
                        className={`text-sm p-3 rounded-xl ${
                          m.role === 'user' 
                            ? 'bg-blue-500 text-white rounded-br-sm' 
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm'
                        }`}
                      >
                        {part.text}
                      </MessageContent>
                    );
                  }
                  if (isToolPart(part)) {
                    return renderToolPart(part, idx);
                  }
                  return null;
                })}
              </div>
            </Message>
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

      <div className="p-3 border-t border-slate-200 bg-white">
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={isLoading}
          className="bg-slate-50 border-slate-200"
        >
          <PromptInputTextarea
            placeholder="描述你想要自动化的操作..."
            className="text-sm min-h-[44px]"
          />
          <PromptInputActions className="justify-end px-2 pb-2">
            <PromptInputAction tooltip="发送消息 (Enter)">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
                className="p-2 rounded-full bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
              >
                {isLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ArrowUp size={16} />
                )}
              </button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}

