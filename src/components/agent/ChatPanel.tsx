import { useEffect, useState } from 'react';
import { type UIMessage } from '@ai-sdk/react';
import { Loader2 } from 'lucide-react';
import { getSettings } from '../../lib/settings';
import { Chat } from './Chat';

interface ChatPanelProps {
  chatId: string;
  isNewChat: boolean;
  onConversationCreated?: (id: string) => void;
}

async function loadMessages(serverUrl: string, chatId: string): Promise<UIMessage[]> {
  const res = await fetch(`${serverUrl}/api/conversations/${chatId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.messages || []).map((m: any) => ({
    id: m.id,
    role: m.role,
    parts: m.parts,
  }));
}

export function ChatPanel({ chatId, isNewChat, onConversationCreated }: ChatPanelProps) {
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);

  useEffect(() => {
    const init = async () => {
      const settings = await getSettings();
      const url = settings.agentServerUrl || 'http://localhost:3000';
      setServerUrl(url);
      
      if (isNewChat) {
        setInitialMessages([]);
      } else {
        const msgs = await loadMessages(url, chatId);
        setInitialMessages(msgs);
      }
    };
    init();
  }, [chatId, isNewChat]);

  if (initialMessages === null) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        加载中...
      </div>
    );
  }

  return (
    <Chat
      chatId={chatId}
      isNewChat={isNewChat}
      serverUrl={serverUrl}
      initialMessages={initialMessages}
      onConversationCreated={onConversationCreated}
    />
  );
}
