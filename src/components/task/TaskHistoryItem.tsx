import { useState } from 'react';
import { Play, Save, Trash2, Clock, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { AgentTask } from '../../lib/agent';
import { PromptDisplay } from './PromptDisplay';
import { StepsPreview } from './StepsPreview';
import { ScriptPreview } from './ScriptPreview';
import { formatTimeAgo } from './utils';

interface TaskHistoryItemProps {
  task: AgentTask;
  onExecute: () => void;
  onSaveAsScript: () => void;
  onDelete: () => void;
  onCopyToInput: (text: string) => void;
}

export function TaskHistoryItem({ 
  task, 
  onExecute, 
  onSaveAsScript, 
  onDelete,
  onCopyToInput
}: TaskHistoryItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
      <div className="p-3 space-y-2">
        {/* 第一行：用户表述 */}
        <PromptDisplay prompt={task.prompt} showLabel={false} />
        
        {/* 第二行：操作按钮 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCopyToInput(task.prompt)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
          >
            <Copy size={12} />
            填入输入框
          </button>
          <button
            onClick={onExecute}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
          >
            <Play size={12} />
            执行
          </button>
          <button
            onClick={onSaveAsScript}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          >
            <Save size={12} />
            保存为脚本
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <Trash2 size={12} />
            删除
          </button>
        </div>
        
        {/* 第三行：信息栏 + 展开/折叠 */}
        <div 
          className="flex items-center justify-between text-xs text-slate-400 cursor-pointer hover:text-slate-600 pl-2"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-1">
            <span>{expanded ? '收起' : '展开'}</span>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </div>
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
