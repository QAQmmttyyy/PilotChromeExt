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
  Zap,
  Trash2,
  Save,
  Clock,
  History
} from 'lucide-react';
import { PilotAgent, AgentState, createAgent, AgentTask, agentTaskStorage } from '../lib/agent';
import { settings } from '../lib/settings';
import { RecordedStep } from '../lib/types';
import { AVAILABLE_MODELS, getModelInfo } from '../lib/ai';
import { parseScriptToWorkflow } from '../lib/parser';
import { Script, storage } from '../lib/storage';

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

function StepsPreview({ steps, compact = false }: { steps: RecordedStep[]; compact?: boolean }) {
  if (steps.length === 0) return null;

  return (
    <div className={compact ? "space-y-0.5" : "space-y-1"}>
      {steps.map((step, idx) => (
        <div 
          key={step.id} 
          className={`flex items-start gap-2 ${compact ? 'py-1' : 'p-2 bg-slate-50 rounded-lg'} text-sm`}
        >
          <span className="text-slate-400 w-5 text-right shrink-0">{idx + 1}.</span>
          <StepIcon type={step.type} />
          <span className="text-slate-700 flex-1 text-xs">
            {step.type === 'navigate' ? (
              <span className="font-mono text-blue-600 break-all">{step.url}</span>
            ) : (
              step.value
            )}
          </span>
        </div>
      ))}
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

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return '刚刚';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function TaskHistoryItem({ 
  task, 
  onExecute, 
  onSaveAsScript, 
  onDelete 
}: { 
  task: AgentTask; 
  onExecute: () => void; 
  onSaveAsScript: () => void; 
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div 
        className="flex items-start gap-2 p-3 cursor-pointer hover:bg-slate-50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="shrink-0 pt-0.5">
          {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-700 line-clamp-2">{task.prompt}</div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{task.steps.length} 步骤</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatTimeAgo(task.createdAt)}
            </span>
            {task.executedAt && (
              <>
                <span>·</span>
                <span className="text-green-600">已执行</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={onExecute}
            className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"
            title="执行"
          >
            <Play size={14} />
          </button>
          <button
            onClick={onSaveAsScript}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="保存为脚本"
          >
            <Save size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50">
          <StepsPreview steps={task.steps} compact />
          <ScriptPreview script={task.script} />
        </div>
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
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const agentRef = useRef<PilotAgent | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkApiKey();
    loadTasks();
    
    // 监听 workflow 状态更新
    const handleMessage = (message: any) => {
      if (message.type === 'WORKFLOW_STATUS_UPDATE') {
        const { status, error } = message.payload;
        setIsExecuting(false);
        if (status === 'failed' && error) {
          setExecuteError(error);
        } else if (status === 'completed') {
          setExecuteError(null);
        }
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const checkApiKey = async () => {
    const has = await settings.hasApiKey();
    setHasApiKey(has);
    const config = await settings.getAIConfig();
    const modelInfo = getModelInfo(config.model);
    if (modelInfo) setCurrentModel(modelInfo);
  };

  const loadTasks = async () => {
    const savedTasks = await agentTaskStorage.getTasks();
    setTasks(savedTasks);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;

    const config = await settings.getAIConfig();
    if (!config.apiKey) {
      onOpenSettings();
      return;
    }

    const taskId = crypto.randomUUID();
    setCurrentTaskId(taskId);

    const agent = createAgent(
      { apiKey: config.apiKey, model: config.model },
      setAgentState
    );
    agentRef.current = agent;

    try {
      const finalState = await agent.run(prompt.trim());
      
      // 保存到历史
      const newTask: AgentTask = {
        id: taskId,
        prompt: prompt.trim(),
        steps: finalState.steps,
        script: finalState.script,
        status: 'completed',
        createdAt: Date.now(),
      };
      await agentTaskStorage.saveTask(newTask);
      await loadTasks();
      setPrompt('');
    } catch (error) {
      console.error('Agent error:', error);
      // 保存失败的任务
      const failedTask: AgentTask = {
        id: taskId,
        prompt: prompt.trim(),
        steps: agentState.steps,
        script: agentState.script,
        status: 'failed',
        createdAt: Date.now(),
      };
      await agentTaskStorage.saveTask(failedTask);
      await loadTasks();
    }
  };

  const handleExecute = async (task?: AgentTask) => {
    const scriptToRun = task?.script || agentState.script;
    const taskId = task?.id || currentTaskId;

    if (!scriptToRun) {
      alert('没有可执行的脚本');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      alert('无法获取当前标签页');
      return;
    }

    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      alert('无法在此页面执行，请打开一个普通网页');
      return;
    }

    setIsExecuting(true);
    setExecuteError(null);

    try {
      const workflowSteps = parseScriptToWorkflow(scriptToRun);
      await chrome.runtime.sendMessage({
        type: 'START_WORKFLOW',
        payload: { steps: workflowSteps, tabId: tab.id }
      });

      // 更新执行时间
      if (taskId) {
        await agentTaskStorage.updateExecutedAt(taskId);
        await loadTasks();
      }
    } catch (error) {
      console.error('Execute error:', error);
      setIsExecuting(false);
      setExecuteError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleSaveAsScript = async (task: AgentTask) => {
    const newScript: Script = {
      id: crypto.randomUUID(),
      name: task.prompt.slice(0, 30) + (task.prompt.length > 30 ? '...' : ''),
      description: `由 Agent 生成：${task.prompt}`,
      code: task.script,
      steps: task.steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await storage.saveScript(newScript);
    alert('已保存到脚本列表');
  };

  const handleDeleteTask = async (taskId: string) => {
    if (confirm('确定删除此任务？')) {
      await agentTaskStorage.deleteTask(taskId);
      await loadTasks();
    }
  };

  const isProcessing = ['thinking', 'generating_steps', 'generating_script', 'running'].includes(agentState.status) || isExecuting;

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

        {/* 当前任务预览（生成中或刚完成） */}
        {(agentState.steps.length > 0 || agentState.script) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
            {agentState.steps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-slate-700">执行步骤</span>
                  <span className="text-xs text-slate-400">({agentState.steps.length} 步)</span>
                </div>
                <StepsPreview steps={agentState.steps} />
              </div>
            )}
            
            {agentState.script && (
              <>
                <ScriptPreview script={agentState.script} />
                
                {agentState.status === 'completed' && (
                  <button
                    onClick={() => handleExecute()}
                    disabled={isExecuting}
                    className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        执行中...
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        在当前页面执行
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* 错误显示 */}
        {(agentState.error || executeError) && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="flex items-center gap-2 text-red-700 text-sm font-medium mb-1">
              <XCircle size={16} />
              {executeError ? 'Workflow 执行失败' : '生成出错'}
            </div>
            <p className="text-red-600 text-xs">{executeError || agentState.error}</p>
            {executeError && (
              <button
                onClick={() => setExecuteError(null)}
                className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                关闭
              </button>
            )}
          </div>
        )}

        {/* 任务历史 */}
        {tasks.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <History size={14} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">任务历史</span>
              <span className="text-xs text-slate-400">({tasks.length})</span>
            </div>
            <div className="space-y-2">
              {tasks.map(task => (
                <TaskHistoryItem
                  key={task.id}
                  task={task}
                  onExecute={() => handleExecute(task)}
                  onSaveAsScript={() => handleSaveAsScript(task)}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
