import { useEffect, useRef } from 'react';
import { Brain, Circle, MessageSquare, RotateCcw, Sparkles, X } from 'lucide-react';
import { ChatMessage, AIModel } from '../../lib/ai';

interface AiChatPanelProps {
  chatHistory: ChatMessage[];
  showChat: boolean;
  setShowChat: (show: boolean) => void;
  isGenerating: boolean;
  streamingContent: string;
  onClearHistory: () => void;
  aiPrompt: string;
  setAiPrompt: (prompt: string) => void;
  onGenerate: () => void;
  currentModel: AIModel;
  recordingContext: string;
  onClearContext: () => void;
}

export function AiChatPanel({
  chatHistory,
  showChat,
  setShowChat,
  isGenerating,
  streamingContent,
  onClearHistory,
  aiPrompt,
  setAiPrompt,
  onGenerate,
  currentModel,
  recordingContext,
  onClearContext
}: AiChatPanelProps) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamingContent, showChat]);

  return (
    <>
      {showChat && (chatHistory.length > 0 || streamingContent) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-h-48 overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">对话历史</span>
              {isGenerating && (
                <span className="text-xs text-purple-600 animate-pulse">生成中...</span>
              )}
            </div>
            <button onClick={onClearHistory} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
              <RotateCcw size={12} />
              清空
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {chatHistory.map((msg, idx) => (
              <div
                key={idx}
                className={`text-xs p-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-50 text-blue-800 ml-4'
                    : 'bg-slate-100 text-slate-700 mr-4'
                }`}
              >
                <div className="font-medium mb-0.5">{msg.role === 'user' ? '你' : 'AI'}</div>
                <div className="line-clamp-2">{msg.content.slice(0, 100)}{msg.content.length > 100 ? '...' : ''}</div>
              </div>
            ))}
            {streamingContent && (
              <div className="text-xs p-2 rounded-lg bg-purple-50 text-purple-800 mr-4 border border-purple-200">
                <div className="font-medium mb-0.5 flex items-center gap-1">
                  <Sparkles size={10} className="animate-spin" />
                  AI 正在生成...
                </div>
                <pre className="whitespace-pre-wrap font-mono text-[10px] max-h-24 overflow-auto">
                  {streamingContent.slice(-500)}
                </pre>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-700">AI 助手</span>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`ml-auto flex items-center gap-1 px-2 py-1 rounded text-xs ${showChat ? 'bg-purple-100 text-purple-700' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <MessageSquare size={12} />
            {showChat ? '隐藏对话' : '显示对话'} {chatHistory.length > 0 && `(${chatHistory.length})`}
          </button>
          {chatHistory.length > 0 && !showChat && (
            <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded">多轮对话中</span>
          )}
        </div>

        {recordingContext && (
          <div className="text-xs bg-slate-50 p-2 rounded-lg max-h-20 overflow-auto">
            <div className="flex items-center gap-1 text-purple-600 mb-1">
              <Circle size={8} className="fill-current" />
              <span className="font-medium">录制上下文</span>
              <button 
                onClick={onClearContext}
                className="ml-auto text-slate-400 hover:text-red-500"
              >
                <X size={12} />
              </button>
            </div>
            <div className="text-slate-500 font-mono text-[10px]">
              {recordingContext.slice(0, 200)}...
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            placeholder={chatHistory.length > 0 ? "继续对话..." : "描述你想要的自动化操作..."}
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isGenerating) {
                onGenerate();
              }
            }}
            disabled={isGenerating}
          />
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm hover:opacity-90 transition-opacity font-medium disabled:opacity-50"
          >
            {isGenerating ? '...' : '发送'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          {currentModel.thinking && <Brain size={10} className="text-purple-500" />}
          <span>{currentModel.name}</span>
          <span className="text-slate-300">·</span>
          <span className="text-purple-500">{currentModel.context} context</span>
        </div>
      </div>
    </>
  );
}

