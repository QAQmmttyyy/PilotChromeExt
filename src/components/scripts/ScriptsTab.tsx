import React, { useState, useEffect, useRef } from 'react';
import { Script, storage } from '../../lib/storage';
import { parseScriptToWorkflow } from '../../lib/parser';
import { generateScriptStream, cleanGeneratedCode, buildUserMessage, buildRecordingContext, AVAILABLE_MODELS, ChatMessage, getModelInfo } from '../../lib/ai';
import { settings } from '../../lib/settings';
import { RecordingSession, RecordedStep } from '../../lib/types';
import { SEED_SCRIPT } from './utils';
import { ScriptList } from './ScriptList';
import { ScriptEditor } from './ScriptEditor';

export function ScriptsTab({ 
  onOpenSettings 
}: { 
  onOpenSettings: () => void;
}) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
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

  return (
    <div className="h-full flex flex-col">
      {view === 'list' ? (
        <ScriptList
          scripts={scripts}
          hasApiKey={hasApiKey}
          onEdit={handleEdit}
          onRun={handleRun}
          onDelete={handleDelete}
          onCreateNew={handleCreateNew}
        />
      ) : currentScript ? (
        <ScriptEditor
          script={currentScript}
          onUpdateScript={(updates) => setCurrentScript({ ...currentScript, ...updates })}
          onBack={() => { loadScripts(); setView('list'); }}
          onRun={() => handleRun(currentScript)}
          onSave={handleSave}
          saveStatus={saveStatus}
          codeUpdateStatus={codeUpdateStatus}
          // Chat props
          chatHistory={chatHistory}
          showChat={showChat}
          setShowChat={setShowChat}
          isGenerating={isGenerating}
          streamingContent={streamingContent}
          onClearHistory={clearChatHistory}
          aiPrompt={aiPrompt}
          setAiPrompt={setAiPrompt}
          onGenerate={handleAiGenerate}
          currentModel={currentModel}
          recordingContext={recordingContext}
          onClearContext={() => setRecordingContext('')}
          // Recording props
          recordingSession={recordingSession}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onPauseRecording={handlePauseRecording}
          onResumeRecording={handleResumeRecording}
          onDeleteStep={handleDeleteStep}
          onUpdateStep={handleUpdateStep}
          onClearRecording={handleClearRecording}
          onUseRecording={handleUseRecording}
          onAddAiStep={handleAddAiStep}
        />
      ) : null}
    </div>
  );
}
