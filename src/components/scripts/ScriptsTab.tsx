import { useState, useEffect, useRef } from 'react';
import { Play, Plus, Trash2, ArrowLeft, Save, Sparkles, Settings, MessageSquare, RotateCcw, Brain, Circle, X } from 'lucide-react';
import { Script, storage } from '../../lib/storage';
import { parseScriptToWorkflow } from '../../lib/parser';
import { generateScriptStream, cleanGeneratedCode, buildUserMessage, buildRecordingContext, AVAILABLE_MODELS, ChatMessage, getModelInfo } from '../../lib/ai';
import { settings } from '../../lib/settings';
import { RecordingSession, RecordedStep } from '../../lib/types';
import { RecordingPanel } from './RecordingPanel';
import { SettingsPanel } from '../shared/SettingsPanel';
import { SEED_SCRIPT } from './utils';

export function ScriptsTab({ 
  onOpenSettings, 
  showSettings,
  onCloseSettings 
}: { 
  onOpenSettings: () => void;
  showSettings: boolean;
  onCloseSettings: () => void;
}) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [currentModel, setCurrentModel] = useState(AVAILABLE_MODELS[0]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [codeUpdateStatus, setCodeUpdateStatus] = useState<'idle' | 'updated'>('idle');
  const [streamingContent, setStreamingContent] = useState('');
  
  const saveTimeoutRef = useRef<number | null>(null);
  
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recordingContext, setRecordingContext] = useState<string>('');

  useEffect(() => {
    loadScripts();
    checkApiKey();
    
    const handleMessage = (message: any) => {
      if (message.type === 'RECORDING_SESSION_UPDATE') {
        if (currentScript && message.scriptId === currentScript.id) {
          setRecordingSession(message.payload);
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [currentScript?.id]);

  useEffect(() => {
    if (currentScript) {
      loadRecordingSession(currentScript.id);
    } else {
      setRecordingSession(null);
      setRecordingContext('');
    }
  }, [currentScript?.id]);
  
  const loadRecordingSession = async (scriptId: string) => {
    try {
      const response = await chrome.runtime.sendMessage({ 
        type: 'RECORDING_GET_SESSION',
        payload: { scriptId }
      });
      if (response?.session) {
        setRecordingSession(response.session);
      } else {
        setRecordingSession(null);
      }
    } catch (e) {
      console.warn('Failed to load recording session:', e);
    }
  };
  
  const handleStartRecording = async () => {
    if (!currentScript) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;
    
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      alert('无法在此页面录制，请打开一个普通网页');
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RECORDING_START',
        payload: { tabId: tab.id, scriptId: currentScript.id }
      });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to start recording:', e);
    }
  };
  
  const handleStopRecording = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RECORDING_STOP' });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to stop recording:', e);
    }
  };
  
  const handlePauseRecording = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RECORDING_PAUSE' });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to pause recording:', e);
    }
  };
  
  const handleResumeRecording = async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'RECORDING_RESUME' });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to resume recording:', e);
    }
  };
  
  const handleDeleteStep = async (stepId: string) => {
    if (!currentScript) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RECORDING_DELETE_STEP',
        payload: { scriptId: currentScript.id, stepId }
      });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to delete step:', e);
    }
  };
  
  const handleClearRecording = async () => {
    if (!currentScript) return;
    try {
      await chrome.runtime.sendMessage({ 
        type: 'RECORDING_CLEAR',
        payload: { scriptId: currentScript.id }
      });
      setRecordingSession(null);
      setRecordingContext('');
    } catch (e) {
      console.error('Failed to clear recording:', e);
    }
  };

  const handleAddAiStep = async (instruction: string) => {
    if (!currentScript) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RECORDING_ADD_AI_STEP',
        payload: { scriptId: currentScript.id, instruction }
      });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to add AI step:', e);
    }
  };

  const handleUpdateStep = async (stepId: string, updates: Partial<RecordedStep>) => {
    if (!currentScript) return;
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RECORDING_UPDATE_STEP',
        payload: { scriptId: currentScript.id, stepId, updates }
      });
      if (response?.session) {
        setRecordingSession(response.session);
      }
    } catch (e) {
      console.error('Failed to update step:', e);
    }
  };
  
  const handleUseRecording = () => {
    if (!recordingSession || recordingSession.steps.length === 0) return;
    
    const context = buildRecordingContext(recordingSession);
    setRecordingContext(context);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const checkApiKey = async () => {
    const has = await settings.hasApiKey();
    setHasApiKey(has);
    const config = await settings.getAIConfig();
    const modelInfo = getModelInfo(config.model);
    if (modelInfo) setCurrentModel(modelInfo);
  };

  const loadScripts = async () => {
    let savedScripts = await storage.getScripts();
    if (savedScripts.length === 0) {
      await storage.saveScript(SEED_SCRIPT);
      savedScripts = [SEED_SCRIPT];
    }
    setScripts(savedScripts);
  };

  const handleCreateNew = () => {
    const newScript: Script = {
      id: crypto.randomUUID(),
      name: '新脚本',
      description: 'AI 生成',
      code: '// 使用 AI 助手生成脚本\n',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setCurrentScript(newScript);
    setChatHistory([]);
    setView('editor');
  };

  const handleEdit = (script: Script) => {
    setCurrentScript(script);
    setChatHistory([]);
    setView('editor');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定删除此脚本？')) {
      await storage.deleteScript(id);
      loadScripts();
    }
  };

  const handleSave = async () => {
    if (!currentScript) return;
    
    setSaveStatus('saving');
    try {
      const updatedScript = { ...currentScript, updatedAt: Date.now() };
      await storage.saveScript(updatedScript);
      setScripts(prev => {
        const idx = prev.findIndex(s => s.id === updatedScript.id);
        if (idx >= 0) {
          const newScripts = [...prev];
          newScripts[idx] = updatedScript;
          return newScripts;
        }
        return [...prev, updatedScript];
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  useEffect(() => {
    if (view === 'editor' && currentScript && !isGenerating) {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = window.setTimeout(() => {
        handleSave();
      }, 1000);
    }
    
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentScript?.code, currentScript?.name, isGenerating, view]);

  const handleRun = async (script: Script) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    const workflowSteps = parseScriptToWorkflow(script.code);
    const isWorkflow = workflowSteps.length > 1 || (workflowSteps.length === 1 && workflowSteps[0].url);

    if (!isWorkflow) {
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || !tab.url) {
        alert('请先打开一个网页，或在脚本中指定目标 URL');
        return;
      }
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'START_WORKFLOW',
        payload: { steps: workflowSteps, tabId: tab.id }
      });
    } catch (err) {
      console.error('Failed to start workflow:', err);
      alert('启动失败');
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;

    const config = await settings.getAIConfig();
    if (!config.apiKey) {
      onOpenSettings();
      return;
    }

    const userMessage = buildUserMessage(aiPrompt, recordingContext);
    const newUserMsg: ChatMessage = { role: 'user', content: aiPrompt };
    
    const updatedHistory = [...chatHistory, newUserMsg];
    setChatHistory(updatedHistory);
    setShowChat(true);
    
    setIsGenerating(true);
    setStreamingContent('');
    setCodeUpdateStatus('idle');
    let generatedCode = '';

    try {
      const messagesForApi: ChatMessage[] = updatedHistory.map((msg, idx) => {
        if (msg.role === 'user' && idx === updatedHistory.length - 1) {
          return { role: 'user', content: userMessage };
        }
        return msg;
      });

      for await (const chunk of generateScriptStream(messagesForApi, config)) {
        generatedCode += chunk;
        setStreamingContent(generatedCode);
      }

      const cleanedCode = cleanGeneratedCode(generatedCode);
      if (currentScript && cleanedCode) {
        setCurrentScript({
          ...currentScript,
          code: cleanedCode
        });
        setCodeUpdateStatus('updated');
        setTimeout(() => setCodeUpdateStatus('idle'), 2000);
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: generatedCode };
      setChatHistory([...updatedHistory, assistantMsg]);
      
      setAiPrompt('');
      setStreamingContent('');
    } catch (err: any) {
      console.error('AI generation failed:', err);
      const errorMsg: ChatMessage = { role: 'assistant', content: `❌ 错误: ${err.message}` };
      setChatHistory([...updatedHistory, errorMsg]);
      setStreamingContent('');
    } finally {
      setIsGenerating(false);
    }
  };

  const clearChatHistory = () => {
    setChatHistory([]);
  };

  if (view === 'editor' && currentScript) {
    return (
      <div className="h-full flex flex-col">
        {showSettings && <SettingsPanel onClose={onCloseSettings} />}
        
        <header className="p-3 bg-white border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={() => { loadScripts(); setView('list'); }} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <ArrowLeft size={18} />
            </button>
            <input
              value={currentScript.name}
              onChange={e => setCurrentScript({ ...currentScript, name: e.target.value })}
              className="font-semibold text-slate-800 bg-transparent border-none focus:ring-0 w-32"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onOpenSettings}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              title="设置"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => handleRun(currentScript)}
              className="px-3 py-1.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
            >
              <Play size={16} />
              运行
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`p-2 rounded-lg flex items-center gap-1 text-sm transition-colors ${
                saveStatus === 'saved' ? 'text-green-600 bg-green-50' :
                saveStatus === 'error' ? 'text-red-600 bg-red-50' :
                saveStatus === 'saving' ? 'text-slate-400' :
                'text-green-600 hover:bg-green-50'
              }`}
              title="保存"
            >
              <Save size={18} />
              {saveStatus === 'saving' && <span className="text-xs">...</span>}
              {saveStatus === 'saved' && <span className="text-xs">✓</span>}
              {saveStatus === 'error' && <span className="text-xs">✗</span>}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm min-h-[200px]">
            <div className="bg-slate-50 px-4 py-2 text-xs text-slate-500 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="font-medium">代码编辑器</span>
                {codeUpdateStatus === 'updated' && (
                  <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded animate-pulse">
                    ✓ 代码已更新
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowChat(!showChat)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${showChat ? 'bg-purple-100 text-purple-700' : 'hover:bg-slate-100'}`}
              >
                <MessageSquare size={12} />
                对话 {chatHistory.length > 0 && `(${chatHistory.length})`}
              </button>
            </div>
            <textarea
              className="flex-1 w-full p-4 font-mono text-xs resize-none focus:outline-none leading-relaxed text-slate-700"
              value={currentScript.code}
              onChange={e => setCurrentScript({ ...currentScript, code: e.target.value })}
              spellCheck={false}
            />
          </div>

          {showChat && (chatHistory.length > 0 || streamingContent) && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm max-h-48 overflow-hidden flex flex-col">
              <div className="px-3 py-2 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">对话历史</span>
                  {isGenerating && (
                    <span className="text-xs text-purple-600 animate-pulse">生成中...</span>
                  )}
                </div>
                <button onClick={clearChatHistory} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
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

          <RecordingPanel
            session={recordingSession}
            onStart={handleStartRecording}
            onStop={handleStopRecording}
            onPause={handlePauseRecording}
            onResume={handleResumeRecording}
            onDeleteStep={handleDeleteStep}
            onUpdateStep={handleUpdateStep}
            onClear={handleClearRecording}
            onUseRecording={handleUseRecording}
            onAddAiStep={handleAddAiStep}
          />

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700">AI 助手</span>
              {chatHistory.length > 0 && (
                <span className="text-xs text-purple-500 bg-purple-50 px-2 py-0.5 rounded">多轮对话中</span>
              )}
            </div>

            {recordingContext && (
              <div className="text-xs bg-slate-50 p-2 rounded-lg max-h-20 overflow-auto">
                <div className="flex items-center gap-1 text-purple-600 mb-1">
                  <Circle size={8} className="fill-current" />
                  <span className="font-medium">录制上下文</span>
                  <button 
                    onClick={() => setRecordingContext('')}
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
                    handleAiGenerate();
                  }
                }}
                disabled={isGenerating}
              />
              <button
                onClick={handleAiGenerate}
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
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="h-full flex flex-col">
      {showSettings && <SettingsPanel onClose={onCloseSettings} />}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!hasApiKey && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-purple-800 mb-1">
              <Sparkles size={16} />
              配置 AI 开始使用
            </div>
            <p className="text-purple-600 text-xs">
              点击设置按钮，输入 OpenRouter API Key
            </p>
          </div>
        )}

        <button
          onClick={handleCreateNew}
          className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-blue-600"
        >
          <Plus size={20} />
          <span className="font-medium">创建新脚本</span>
        </button>

        {scripts.map(script => (
          <div
            key={script.id}
            onClick={() => handleEdit(script)}
            className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-slate-800 group-hover:text-blue-600">{script.name}</h3>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => handleRun(script)}
                  className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
                >
                  <Play size={16} />
                </button>
                <button
                  onClick={(e) => handleDelete(e, script.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2">{script.description || '无描述'}</p>
            <div className="mt-2 text-xs text-slate-400">
              {new Date(script.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

