import { useState, useEffect } from 'react';
import { CircleCheck, XCircle, Loader2, Clock, ChevronDown, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExecuteWorkflowOutput, PageAgentLogEntry } from '@pilot/shared';

interface Props {
  output: ExecuteWorkflowOutput;
}

export function WorkflowExecutionDisplay({ output }: Props) {
  // For history messages (completed/failed), collapse all steps by default
  // For active messages (running/pending), expand all steps
  const isHistoryMessage = output.status === 'completed' || output.status === 'failed';
  
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => {
    if (isHistoryMessage) {
      return new Set<number>();
    }
    const allSteps = new Set<number>();
    output.steps.forEach((_, idx) => allSteps.add(idx));
    return allSteps;
  });

  // Auto-expand new steps when they are added (only for active workflows)
  useEffect(() => {
    if (!isHistoryMessage) {
      setExpandedSteps(prev => {
        const next = new Set(prev);
        output.steps.forEach((_, idx) => {
          next.add(idx);
        });
        return next;
      });
    }
  }, [output.steps.length, isHistoryMessage]);

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="size-4 animate-spin text-blue-500 flex-shrink-0" />;
      case 'completed':
        return <CircleCheck className="size-4 text-emerald-500 flex-shrink-0" />;
      case 'failed':
        return <XCircle className="size-4 text-red-500 flex-shrink-0" />;
      default:
        return <Clock className="size-4 text-slate-400 flex-shrink-0" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const base = 'px-2 py-0.5 rounded-full text-xs font-medium';
    switch (status) {
      case 'running':
        return <span className={cn(base, 'bg-blue-100 text-blue-700')}>执行中</span>;
      case 'completed':
        return <span className={cn(base, 'bg-emerald-100 text-emerald-700')}>已完成</span>;
      case 'failed':
        return <span className={cn(base, 'bg-red-100 text-red-700')}>失败</span>;
      default:
        return <span className={cn(base, 'bg-slate-100 text-slate-600')}>等待中</span>;
    }
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return null;
    const seconds = (end - start) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  return (
    <div className="rounded-lg overflow-hidden max-w-full border bg-white">
      {/* Header - px-3 to align with step icons */}
      <div className="px-3 py-2.5 border-b flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <Play className="size-4 text-slate-500 flex-shrink-0" />
          <span className="font-medium text-sm text-slate-700 whitespace-nowrap">Workflow</span>
          {getStatusBadge(output.status)}
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-2 flex-shrink-0 whitespace-nowrap">
          {output.totalSteps > 0 && (
            <span>
              {output.currentStep + 1}/{output.totalSteps}
            </span>
          )}
          {output.endTime && output.startTime && (
            <span className="text-slate-400">
              {formatDuration(output.startTime, output.endTime)}
            </span>
          )}
        </div>
      </div>

      {/* Steps list */}
      {output.steps.length > 0 && (
        <div className="divide-y divide-slate-100">
          {output.steps.map((step, idx) => {
            const isExpanded = expandedSteps.has(idx);
            const hasLogs = step.pageAgentLogs && step.pageAgentLogs.length > 0;

            return (
              <div key={idx} className="bg-white">
                {/* Step header (clickable) */}
                <button
                  onClick={() => toggleStep(idx)}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left gap-3"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getStatusIcon(step.status)}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-700">
                        {step.stepName || `步骤 ${idx + 1}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {step.endTime && step.startTime && (
                      <span className="text-xs text-slate-400 whitespace-nowrap">
                        {formatDuration(step.startTime, step.endTime)}
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        "size-4 text-slate-400 transition-transform flex-shrink-0",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {/* Instruction (always visible, aligned with step name text) */}
                {step.instruction && (
                  <div className="pl-9 pr-3 pb-2 text-xs text-slate-600 leading-relaxed break-words">
                    {step.instruction}
                  </div>
                )}
                {step.url && !step.instruction && (
                  <div className="pl-9 pr-3 pb-2 text-xs text-slate-400 truncate">
                    {step.url}
                  </div>
                )}

                {/* Expanded details - only render if has content */}
                {isExpanded && (step.error || hasLogs) && (
                  <div className="pl-9 pr-3 pb-3 space-y-2">
                    {step.error && (
                      <div className="p-2 bg-red-50 text-red-700 rounded text-xs break-words">
                        <span className="font-medium">错误: </span>{step.error}
                      </div>
                    )}

                    {/* PageAgent logs */}
                    {hasLogs && step.pageAgentLogs!.map((log, logIdx) => (
                      <PageAgentLogItem key={logIdx} log={log} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {output.steps.length === 0 && output.status === 'pending' && (
        <div className="p-4 text-center text-sm text-slate-400">
          等待执行...
        </div>
      )}

      {/* Error banner */}
      {output.error && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100">
          <div className="text-sm text-red-700 font-medium">执行失败</div>
          <div className="text-xs text-red-600 mt-1">{output.error}</div>
        </div>
      )}
    </div>
  );
}

function PageAgentLogItem({ log }: { log: PageAgentLogEntry }) {
  const getLogIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CircleCheck className="size-4 text-emerald-500 flex-shrink-0" />;
      case 'error':
        return <XCircle className="size-4 text-red-500 flex-shrink-0" />;
      default:
        return <Loader2 className="size-4 animate-spin text-blue-500 flex-shrink-0" />;
    }
  };

  // Extract output text from details or result
  const outputText = log.details || (typeof log.result === 'string' ? log.result : undefined);
  const thinking = log.metadata?.thinking;

  return (
    <div className="text-xs">
      <div className="flex gap-2">
        <div className="h-4 flex items-center flex-shrink-0">
          {getLogIcon(log.status)}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          {/* Action name */}
          <div className="font-medium text-slate-800 leading-4">
            {log.action}
          </div>

          {/* Output */}
          {outputText && (
            <div className="text-slate-600 leading-relaxed break-words">
              {outputText}
            </div>
          )}

          {/* Thinking (if long, add scroll) */}
          {thinking && (
            <div className={cn(
              "text-slate-500 text-[11px] italic leading-relaxed break-words",
              thinking.length > 200 && "max-h-20 overflow-y-auto"
            )}>
              {String(thinking)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

