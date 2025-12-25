import React, { useState, useEffect, useRef } from 'react';
import { Play, Plus, Trash2, ArrowLeft, Save, Sparkles, Settings, X, MessageSquare, RotateCcw, Brain, Circle, Square, Pause, Mouse, Type, Navigation, Key, List, Pencil } from 'lucide-react';
import { Script, storage } from '../lib/storage';
import { parseScriptToWorkflow } from '../lib/parser';
import { generateScriptStream, cleanGeneratedCode, buildUserMessage, buildRecordingContext, AVAILABLE_MODELS, ChatMessage, getModelInfo } from '../lib/ai';
import { settings } from '../lib/settings';
import { RecordingSession, RecordedStep } from '../lib/types';

// Seed data
const SEED_SCRIPT: Script = {
  id: 'demo-workflow',
  name: '示例：百度搜索',
  description: '演示如何使用 Pilot 进行多步骤自动化',
  code: `// === STEP: 打开百度 (https://www.baidu.com) ===
(async () => {
  try {
    const input = document.querySelector('#kw');
    if (!input) throw new Error('未找到搜索框');
    input.value = "Pilot Chrome Extension";
    input.dispatchEvent(new Event('input', {bubbles: true}));
    document.querySelector('#su')?.click();
    window.Pilot.workflow.next({ keyword: "Pilot" });
  } catch (err) {
    window.Pilot.workflow.fail(err.message);
  }
})();

// === STEP: 提取搜索结果 (https://www.baidu.com/s) ===
(async () => {
  function waitFor(sel, timeout = 5000) {
    return new Promise((res, rej) => {
      const t = Date.now();
      (function c() {
        const e = document.querySelector(sel);
        e ? res(e) : Date.now() - t > timeout ? rej(new Error('超时')) : setTimeout(c, 200);
      })();
    });
  }
  
  try {
    const result = await waitFor('h3.c-title a', 8000);
    alert('✅ 找到: ' + result.innerText.trim());
    window.Pilot.workflow.finish();
  } catch (err) {
    window.Pilot.workflow.fail(err.message);
  }
})();
`,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

// 录制步骤图标
function StepIcon({ type }: { type: RecordedStep['type'] }) {
  switch (type) {
    case 'click':
      return <Mouse size={12} className="text-blue-500" />;
    case 'input':
      return <Type size={12} className="text-green-500" />;
    case 'navigate':
      return <Navigation size={12} className="text-purple-500" />;
    case 'submit':
      return <Play size={12} className="text-orange-500" />;
    case 'select':
      return <List size={12} className="text-cyan-500" />;
    case 'keypress':
      return <Key size={12} className="text-pink-500" />;
    case 'ai_step':
      return <Sparkles size={12} className="text-purple-500" />;
    default:
      return <Circle size={12} className="text-slate-400" />;
  }
}

// 录制步骤描述
function getStepDescription(step: RecordedStep): string {
  switch (step.type) {
    case 'click':
      return `点击 <${step.element?.tag}> ${step.element?.text?.slice(0, 20) || ''}`;
    case 'input':
      return `输入 "${step.value?.slice(0, 15) || ''}${(step.value?.length || 0) > 15 ? '...' : ''}"`;
    case 'navigate':
      return step.url;
    case 'submit':
      return `提交表单`;
    case 'select':
      return `选择 "${step.value}"`;
    case 'keypress':
      return `按键 ${step.key}`;
    case 'ai_step':
      return `AI 指令: ${step.value}`;
    default:
      return step.type;
  }
}

// 录制面板组件
function RecordingPanel({ 
  session, 
  onStart, 
  onStop, 
  onPause,
  onResume,
  onDeleteStep, 
  onUpdateStep,
  onClear,
  onUseRecording,
  onAddAiStep
}: { 
  session: RecordingSession | null;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDeleteStep: (stepId: string) => void;
  onUpdateStep: (stepId: string, updates: Partial<RecordedStep>) => void;
  onClear: () => void;
  onUseRecording: () => void;
  onAddAiStep: (instruction: string) => void;
}) {
  const isRecording = session?.status === 'recording';
  const isPaused = session?.status === 'paused';
  const hasSteps = session && session.steps.length > 0;
  const stepsEndRef = useRef<HTMLDivElement>(null);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    if (hasSteps) {
      stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [session?.steps.length]);

  const handleAddAiStep = () => {
    if (aiInstruction.trim()) {
      onAddAiStep(aiInstruction.trim());
      setAiInstruction('');
      setShowAiInput(false);
    }
  };

  const startEditing = (step: RecordedStep) => {
    if (step.type === 'ai_step') {
      setEditingStepId(step.id);
      setEditingValue(step.value || '');
    }
  };

  const saveEditing = () => {
    if (editingStepId && editingValue.trim()) {
      onUpdateStep(editingStepId, { value: editingValue.trim() });
    }
    setEditingStepId(null);
    setEditingValue('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : isPaused ? 'bg-yellow-500' : 'bg-slate-300'}`} />
          <span className="text-sm font-medium text-slate-700">
            {isRecording ? '录制中' : isPaused ? '已暂停' : '录制操作'}
          </span>
          {hasSteps && (
            <span className="text-xs text-slate-400">({session.steps.length} 步)</span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {(!session || session.status === 'stopped') ? (
            <button
              onClick={onStart}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
            >
              <Circle size={10} className="fill-current" />
              开始
            </button>
          ) : (
            <>
              {isRecording ? (
                <>
                  <button
                    onClick={() => setShowAiInput(!showAiInput)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 ${showAiInput ? 'bg-purple-600' : 'bg-purple-500'} text-white text-xs rounded-lg hover:bg-purple-600 transition-colors`}
                    title="添加 AI 步骤"
                  >
                    <Sparkles size={12} />
                    AI Step
                  </button>
                <button
                  onClick={onPause}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-500 text-white text-xs rounded-lg hover:bg-yellow-600 transition-colors"
                >
                  <Pause size={12} />
                  暂停
                </button>
                </>
              ) : (
                <button
                  onClick={onResume}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Play size={12} />
                  继续
                </button>
              )}
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-600 text-white text-xs rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Square size={10} className="fill-current" />
                停止
              </button>
            </>
          )}
        </div>
      </div>

      {showAiInput && isRecording && (
        <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex gap-2">
          <input
            autoFocus
            type="text"
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                handleAddAiStep();
              }
            }}
            placeholder="描述 AI 需要执行的操作..."
            className="flex-1 text-xs border border-purple-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
          <button
            onClick={handleAddAiStep}
            disabled={!aiInstruction.trim()}
            className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            添加
          </button>
          <button
            onClick={() => setShowAiInput(false)}
            className="p-1.5 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        </div>
      )}
      
      {hasSteps && (
        <>
          <div className="max-h-48 overflow-y-auto">
            {session.steps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-start gap-2 px-4 py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 group"
              >
                <span className="text-xs text-slate-400 w-4 shrink-0 pt-0.5">{idx + 1}</span>
                <div className="shrink-0 pt-0.5"><StepIcon type={step.type} /></div>
                
                {editingStepId === step.id ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      autoFocus
                      className="flex-1 text-xs border border-purple-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onBlur={saveEditing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          saveEditing();
                        } else if (e.key === 'Escape') {
                          setEditingStepId(null);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <span 
                    className={`flex-1 text-xs text-slate-600 break-all ${step.type === 'ai_step' ? 'cursor-pointer hover:text-purple-600' : ''}`}
                    onClick={() => startEditing(step)}
                    title={step.type === 'ai_step' ? '点击编辑' : undefined}
                  >
                  {getStepDescription(step)}
                </span>
                )}
                
                <div className="flex items-center gap-0.5 shrink-0">
                  {step.type === 'ai_step' && (
                    <button
                      onClick={() => startEditing(step)}
                      className="p-1 text-slate-400 hover:text-purple-600 transition-colors"
                      title="编辑指令"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                <button
                  onClick={() => onDeleteStep(step.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
                </div>
              </div>
            ))}
            <div ref={stepsEndRef} />
          </div>
          
          <div className="px-4 py-2 border-t border-slate-100 flex justify-between items-center bg-slate-50">
            <button
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 size={12} />
              清空
            </button>
            <button
              onClick={onUseRecording}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 transition-colors"
            >
              <Sparkles size={12} />
              用于生成
            </button>
          </div>
        </>
      )}
      
      {!hasSteps && !isRecording && (
        <div className="px-4 py-6 text-center text-xs text-slate-400">
          点击"开始"录制你的操作流程
        </div>
      )}
    </div>
  );
}

// 设置面板
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settings.getAIConfig().then(config => {
      setApiKey(config.apiKey || '');
      setSelectedModel(config.model || AVAILABLE_MODELS[0].id);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await settings.setAIConfig({ apiKey, model: selectedModel });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // 按 provider 分组
  const groupedModels = AVAILABLE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MODELS>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">AI 设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              从 <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">openrouter.ai/keys</a> 获取
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">AI 模型</label>
            <div className="space-y-3">
              {Object.entries(groupedModels).map(([provider, models]) => (
                <div key={provider}>
                  <div className="text-xs font-semibold text-slate-400 mb-1">{provider}</div>
                  <div className="space-y-1">
                    {models.map(model => (
                      <label
                        key={model.id}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedModel === model.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="model"
                          value={model.id}
                          checked={selectedModel === model.id}
                          onChange={() => setSelectedModel(model.id)}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-700">{model.name}</span>
                            {model.thinking && <Brain size={12} className="text-purple-500" />}
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{model.context}</span>
                          </div>
                          <div className="text-xs text-slate-500">{model.description}</div>
                        </div>
                        {selectedModel === model.id && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {isSaving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // 多轮对话
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [currentModel, setCurrentModel] = useState(AVAILABLE_MODELS[0]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [codeUpdateStatus, setCodeUpdateStatus] = useState<'idle' | 'updated'>('idle');
  const [streamingContent, setStreamingContent] = useState('');
  
  const saveTimeoutRef = useRef<number | null>(null);
  
  // Recording
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [recordingContext, setRecordingContext] = useState<string>('');

  useEffect(() => {
    loadScripts();
    checkApiKey();
    
    // 监听录制更新
    const handleMessage = (message: any) => {
      if (message.type === 'RECORDING_SESSION_UPDATE') {
        // 只有当消息中的 scriptId 与当前编辑的脚本 ID 一致时才更新
        if (currentScript && message.scriptId === currentScript.id) {
          setRecordingSession(message.payload);
        }
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [currentScript?.id]);

  // 当切换脚本时加载对应的录制会话
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

  // 自动保存逻辑
  useEffect(() => {
    if (view === 'editor' && currentScript && !isGenerating) {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = window.setTimeout(() => {
        handleSave();
      }, 1000); // 1秒延迟
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
      setShowSettings(true);
      return;
    }

    // 构建用户消息（使用录制上下文）
    const userMessage = buildUserMessage(aiPrompt, recordingContext);
    const newUserMsg: ChatMessage = { role: 'user', content: aiPrompt };
    
    // 添加到历史
    const updatedHistory = [...chatHistory, newUserMsg];
    setChatHistory(updatedHistory);
    setShowChat(true);
    
    setIsGenerating(true);
    setStreamingContent('');
    setCodeUpdateStatus('idle');
    let generatedCode = '';

    try {
      // 构建完整的消息历史（包含页面上下文的第一条消息）
      const messagesForApi: ChatMessage[] = updatedHistory.map((msg, idx) => {
        if (msg.role === 'user' && idx === updatedHistory.length - 1) {
          return { role: 'user', content: userMessage };
        }
        return msg;
      });

      // 流式接收时只更新 streamingContent，不修改代码编辑器
      for await (const chunk of generateScriptStream(messagesForApi, config)) {
        generatedCode += chunk;
        setStreamingContent(generatedCode);
      }

      // AI 响应完成后，提取完整代码并更新到编辑器
      const cleanedCode = cleanGeneratedCode(generatedCode);
      if (currentScript && cleanedCode) {
        setCurrentScript({
          ...currentScript,
          code: cleanedCode
        });
        setCodeUpdateStatus('updated');
        setTimeout(() => setCodeUpdateStatus('idle'), 2000);
      }

      // 添加助手回复到历史
      const assistantMsg: ChatMessage = { role: 'assistant', content: generatedCode };
      setChatHistory([...updatedHistory, assistantMsg]);
      
      setAiPrompt('');
      setStreamingContent('');
    } catch (err: any) {
      console.error('AI generation failed:', err);
      // 添加错误消息
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

  // 编辑器视图
  if (view === 'editor' && currentScript) {
    return (
      <div className="h-screen w-full bg-slate-50 flex flex-col">
        {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); checkApiKey(); }} />}
        
        <header className="p-3 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
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
              onClick={() => setShowSettings(true)}
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

        <div className="flex-1 flex flex-col p-3 gap-3 overflow-hidden">
          {/* 代码编辑器 */}
          <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm min-h-0">
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

          {/* 对话历史 */}
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
                {/* 流式输出显示 */}
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

          {/* 录制面板 */}
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

          {/* AI 助手 */}
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

            {/* 录制上下文显示 */}
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

  // 列表视图
  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col">
      {showSettings && <SettingsPanel onClose={() => { setShowSettings(false); checkApiKey(); }} />}

      <header className="p-4 bg-white border-b border-slate-200 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-800">Pilot</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            title="设置"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleCreateNew}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3">
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
      </main>
    </div>
  );
}

export default App;
