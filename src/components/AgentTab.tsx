import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Sparkles, 
  Navigation, 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Code,
  Zap
} from 'lucide-react';
import { PilotAgent, AgentState, createAgent, ToolCallLog } from '../lib/agent';
import { settings } from '../lib/settings';
import { RecordedStep } from '../lib/types';
import { AVAILABLE_MODELS, getModelInfo } from '../lib/ai';

interface AgentTabProps {
  onOpenSettings: () => void;
}

function StepIcon({ type }: { type: string }) {
  if (type === 'navigate') {
    return <Navigation size={14} className="text-blue-500" />;
  }
  return <Sparkles size={14} className="text-purple-500" />;
}

function StatusBadge({ status }: { status: AgentState['status'] }) {
  const config: Record<AgentState['status'], { label: string; color: string; icon?: React.ReactNode }> = {
    idle: { label: '就绪', color: 'bg-slate-100 text-slate-600' },
    thinking: { label: '思考中', color: 'bg-yellow-100 text-yellow-700', icon: <Loader2 size={12} className="animate-spin" /> },
    generating_steps: { label: '生成步骤', color: 'bg-blue-100 text-blue-700', icon: <Loader2 size={12} className="animate-spin" /> },
    generating_script: { label: '生成脚本', color: 'bg-purple-100 text-purple-700', icon: <Loader2 size={12} className="animate-spin" /> },
    running: { label: '执行中', color: 'bg-green-100 text-green-700', icon: <Loader2 size={12} className="animate-spin" /> },
    completed: { label: '完成', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={12} /> },
    error: { label: '错误', color: 'bg-red-100 text-red-700', icon: <XCircle size={12} /> },
  };

  const { label, color, icon } = config[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {icon}
      {label}
    </span>
  );
}

function StepsPreview({ steps }: { steps: RecordedStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1">
      {steps.map((step, idx) => (
        <div 
          key={step.id} 
          className="flex items-start gap-2 p-2 bg-slate-50 rounded-lg text-sm"
        >
          <span className="text-slate-400 w-5 text-right shrink-0">{idx + 1}.</span>
          <StepIcon type={step.type} />
          <span className="text-slate-700 flex-1">
            {step.type === 'navigate' ? (
              <span className="font-mono text-xs text-blue-600 break-all">{step.url}</span>
            ) : (
              step.value
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function ToolCallsLog({ toolCalls }: { toolCalls: ToolCallLog[] }) {
  const [expanded, setExpanded] = useState(false);

  if (toolCalls.length === 0) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Code size={14} />
        Tool 调用日志 ({toolCalls.length})
      </button>
      {expanded && (
        <div className="p-2 space-y-2 max-h-48 overflow-y-auto">
          {toolCalls.map((call, idx) => (
            <div key={idx} className="text-xs bg-slate-50 rounded p-2">
              <div className="font-medium text-purple-600">{call.name}</div>
              <div className="text-slate-500 mt-1 font-mono text-[10px] break-all">
                {JSON.stringify(call.args).slice(0, 200)}
                {JSON.stringify(call.args).length > 200 && '...'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptPreview({ script }: { script: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!script) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Code size={14} />
        生成的脚本
      </button>
      {expanded && (
        <pre className="p-3 text-xs font-mono bg-slate-900 text-slate-100 overflow-x-auto max-h-64">
          {script}
        </pre>
      )}
    </div>
  );
}

export function AgentTab({ onOpenSettings }: AgentTabProps) {
  const [prompt, setPrompt] = useState('');
  const [agentState, setAgentState] = useState<AgentState>({
    status: 'idle',
    steps: [],
    script: '',
    toolCalls: [],
  });
  const [hasApiKey, setHasApiKey] = useState(false);
  const [currentModel, setCurrentModel] = useState(AVAILABLE_MODELS[0]);
  const agentRef = useRef<PilotAgent | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const has = await settings.hasApiKey();
    setHasApiKey(has);
    const config = await settings.getAIConfig();
    const modelInfo = getModelInfo(config.model);
    if (modelInfo) setCurrentModel(modelInfo);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    const config = await settings.getAIConfig();
    if (!config.apiKey) {
      onOpenSettings();
      return;
    }

    const agent = createAgent(
      { apiKey: config.apiKey, model: config.model },
      setAgentState
    );
    agentRef.current = agent;

    try {
      await agent.run(prompt.trim());
    } catch (error) {
      console.error('Agent error:', error);
    }
  };

  const handleExecute = async () => {
    if (!agentRef.current || agentState.status !== 'completed') return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      alert('无法获取当前标签页');
      return;
    }

    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      alert('无法在此页面执行，请打开一个普通网页');
      return;
    }

    try {
      await agentRef.current.executeScript(tab.id);
    } catch (error) {
      console.error('Execute error:', error);
      alert(`执行失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const isProcessing = ['thinking', 'generating_steps', 'generating_script', 'running'].includes(agentState.status);

  return (
    <div className="flex flex-col h-full">
      {!hasApiKey && (
        <div className="m-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-purple-800 mb-1">
            <Sparkles size={16} />
            配置 AI 开始使用
          </div>
          <p className="text-purple-600 text-xs">
            点击右上角设置按钮，输入 OpenRouter API Key
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* 输入区域 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <Zap size={14} className="text-white" />
              </div>
              <span className="text-sm font-semibold text-slate-700">AI Agent</span>
              <StatusBadge status={agentState.status} />
            </div>
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="描述你想要自动化的操作，例如：&#10;打开百度搜索 AI，点击第一个结果"
              className="w-full h-20 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.metaKey && !isProcessing) {
                  handleSubmit();
                }
              }}
            />
            <div className="flex justify-between items-center mt-2">
              <div className="text-xs text-slate-400">
                {currentModel.name} · ⌘+Enter 发送
              </div>
              <button
                onClick={handleSubmit}
                disabled={isProcessing || !prompt.trim()}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm hover:opacity-90 transition-opacity font-medium disabled:opacity-50 flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    处理中
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    生成
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 步骤预览 */}
        {agentState.steps.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-slate-700">执行步骤</span>
              <span className="text-xs text-slate-400">({agentState.steps.length} 步)</span>
            </div>
            <StepsPreview steps={agentState.steps} />
          </div>
        )}

        {/* 脚本预览 */}
        {agentState.script && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
            <ScriptPreview script={agentState.script} />
            
            {agentState.status === 'completed' && (
              <button
                onClick={handleExecute}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Play size={16} />
                在当前页面执行
              </button>
            )}
          </div>
        )}

        {/* Tool 调用日志 */}
        {agentState.toolCalls.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
            <ToolCallsLog toolCalls={agentState.toolCalls} />
          </div>
        )}

        {/* 错误显示 */}
        {agentState.error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
              <XCircle size={16} />
              执行出错
            </div>
            <p className="text-red-600 text-xs">{agentState.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

