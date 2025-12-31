import { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Sparkles, 
  Loader2, 
  XCircle,
  History
} from 'lucide-react';
import { AgentState, createAgent, AgentTask, agentTaskStorage } from '../../lib/agent';
import { settings } from '../../lib/settings';
import { AVAILABLE_MODELS, getModelInfo } from '../../lib/ai';
import { parseScriptToWorkflow } from '../../lib/parser';
import { Script, storage } from '../../lib/storage';
import { PromptDisplay } from './PromptDisplay';
import { StepsPreview } from './StepsPreview';
import { ScriptPreview } from './ScriptPreview';
import { TaskHistoryItem } from './TaskHistoryItem';

interface TaskTabProps {
  onOpenSettings: () => void;
}

export function TaskTab({ onOpenSettings }: TaskTabProps) {
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
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const agentRef = useRef<ReturnType<typeof createAgent> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkApiKey();
    loadTasks();
    
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
    setCurrentPrompt(prompt.trim());

    const agent = createAgent(
      { apiKey: config.apiKey, model: config.model },
      setAgentState
    );
    agentRef.current = agent;

    try {
      const finalState = await agent.run(prompt.trim());
      
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

    setIsExecuting(true);
    setExecuteError(null);

    try {
      const workflowSteps = parseScriptToWorkflow(scriptToRun);
      await chrome.runtime.sendMessage({
        type: 'START_WORKFLOW',
        payload: { steps: workflowSteps, tabId: tab.id }
      });

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

  const handleCopyToInput = (text: string) => {
    setPrompt(text);
    inputRef.current?.focus();
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

        {/* 当前任务预览 */}
        {(currentPrompt || agentState.steps.length > 0 || agentState.script) && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 space-y-3">
            {currentPrompt && (
              <PromptDisplay 
                prompt={currentPrompt} 
                onCopyToInput={handleCopyToInput}
              />
            )}

            {agentState.steps.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-600">执行步骤</span>
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
                  onCopyToInput={handleCopyToInput}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

