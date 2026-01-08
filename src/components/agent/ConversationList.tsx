import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import { getSettings } from '../../lib/settings';

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationListProps {
  onSelect: (id: string) => void;
  selectedId?: string | null;
}

export interface ConversationListRef {
  refresh: () => void;
}

export const ConversationList = forwardRef<ConversationListRef, ConversationListProps>(
  function ConversationList({ onSelect, selectedId }, ref) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const settings = await getSettings();
      const serverUrl = settings.agentServerUrl || 'http://localhost:3000';
      const res = await fetch(`${serverUrl}/api/conversations`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    refresh: fetchConversations,
  }), [fetchConversations]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const settings = await getSettings();
      const serverUrl = settings.agentServerUrl || 'http://localhost:3000';
      await fetch(`${serverUrl}/api/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        加载中...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 px-4">
        <MessageSquare size={32} className="mb-2 opacity-50" />
        <p className="text-sm">暂无对话记录</p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1 overflow-y-auto h-full">
      {conversations.map(conv => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv.id)}
          className={`group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
            selectedId === conv.id
              ? 'bg-blue-50 border border-blue-200'
              : 'hover:bg-slate-100'
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate">
              {conv.title || '新对话'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(conv.updatedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={(e) => handleDelete(conv.id, e)}
            className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
});

