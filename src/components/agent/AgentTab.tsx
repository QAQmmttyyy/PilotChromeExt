import { useState, useRef } from 'react';
import { Plus, History, Settings } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { ConversationList, ConversationListRef } from './ConversationList';

interface AgentTabProps {
  onOpenSettings?: () => void;
}

export function AgentTab({ onOpenSettings }: AgentTabProps) {
  const [chatId, setChatId] = useState<string>(crypto.randomUUID());
  const [isNewChat, setIsNewChat] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const conversationListRef = useRef<ConversationListRef>(null);

  const handleNewChat = () => {
    setChatId(crypto.randomUUID());
    setIsNewChat(true);
    setShowHistory(false);
  };

  const handleSelectConversation = (id: string) => {
    setChatId(id);
    setIsNewChat(false);
    setShowHistory(false);
  };

  const handleConversationCreated = () => {
    setIsNewChat(false);
    conversationListRef.current?.refresh();
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Plus size={14} />
            新对话
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              showHistory 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <History size={14} />
            历史
          </button>
        </div>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
          >
            <Settings size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {showHistory ? (
          <ConversationList
            ref={conversationListRef}
            onSelect={handleSelectConversation}
            selectedId={chatId}
          />
        ) : (
          <ChatPanel 
            key={chatId}
            chatId={chatId}
            isNewChat={isNewChat}
            onConversationCreated={handleConversationCreated}
          />
        )}
      </div>
    </div>
  );
}

