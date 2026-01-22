import { useState, useEffect } from 'react';
import { CircleCheck, XCircle, Loader2, Clock, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ExecuteWorkflowOutput, PageAgentLogEntry } from '@pilot/shared';

/**
 * WorkflowHeaderExtra - Renders progress and duration in the tool header
 * Handles invalid or missing output gracefully
 */
export function WorkflowHeaderExtra({ output }: { output: ExecuteWorkflowOutput }) {

  const formatDuration = (start: number, end?: number) => {
    if (!end) return null;
    const seconds = (end - start) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  };

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 ml-auto">
      {output.totalSteps > 0 && (
        <span className="tabular-nums font-medium">
          {output.currentStep + 1}/{output.totalSteps}
        </span>
      )}
      {output.endTime && output.startTime && (
        <span className="opacity-70 tabular-nums">
          {formatDuration(output.startTime, output.endTime)}
        </span>
      )}
    </div>
  );
}

/**
 * WorkflowContent - Renders the steps list within the tool content area
 * Handles invalid or missing output gracefully
 */
export function WorkflowContent({ output }: { output: ExecuteWorkflowOutput }) {
  const isHistoryMessage = output.status === 'completed' || output.status === 'failed';

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => {
    if (isHistoryMessage) return new Set<number>();
    const allSteps = new Set<number>();
    output.steps.forEach((_, idx) => allSteps.add(idx));
    return allSteps;
  });

  useEffect(() => {
    if (!isHistoryMessage) {
      setExpandedSteps(prev => {
        const next = new Set(prev);
        output.steps.forEach((_, idx) => next.add(idx));
        return next;
      });
    }
  }, [output.steps.length, isHistoryMessage]);

  const toggleStep = (idx: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="divide-y divide-border">
      {output.steps.map((step, idx) => (
        <WorkflowStep
          key={idx}
          step={step}
          stepIndex={idx}
          isExpanded={expandedSteps.has(idx)}
          onToggle={() => toggleStep(idx)}
        />
      ))}
    </div>
  );
}

/**
 * WorkflowStep - Individual step item with collapsible content
 */
function WorkflowStep({
  step,
  stepIndex,
  isExpanded,
  onToggle,
}: {
  step: ExecuteWorkflowOutput['steps'][0];
  stepIndex: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasLogs = step.pageAgentLogs && step.pageAgentLogs.length > 0;

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="size-4 animate-spin text-blue-500 flex-shrink-0" />;
      case 'completed':
        return <CircleCheck className="size-4 text-emerald-500 flex-shrink-0" />;
      case 'failed':
        return <XCircle className="size-4 text-red-500 flex-shrink-0" />;
      default:
        return <Clock className="size-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return null;
    const seconds = (end - start) / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    return `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto w-full justify-between rounded-none px-3 py-2.5 font-normal hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {getStepIcon(step.status)}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {step.stepName || `步骤 ${stepIndex + 1}`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {step.endTime && step.startTime && (
              <span className="text-xs tabular-nums text-muted-foreground opacity-70">
                {formatDuration(step.startTime, step.endTime)}
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden">
        <div className="bg-muted/10 px-3 pb-3 pt-0">
          <div className="pl-6 space-y-3">
            {step.instruction && (
              <div className="text-xs text-muted-foreground leading-relaxed break-words text-pretty">
                {step.instruction}
              </div>
            )}
            {step.url && !step.instruction && (
              <div className="text-xs text-muted-foreground">
                {step.url}
              </div>
            )}
            {hasLogs && step.pageAgentLogs!.map((log, logIdx) => (
              <PageAgentLogItem key={logIdx} log={log} />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * PageAgentLogItem - Individual page agent log entry
 */
function PageAgentLogItem({ log }: { log: PageAgentLogEntry }) {
  const getLogIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CircleCheck className="size-3.5 text-emerald-500" />;
      case 'error':
        return <XCircle className="size-3.5 text-destructive" />;
      default:
        return <Loader2 className="size-3.5 animate-spin text-blue-500" />;
    }
  };

  const outputText = log.action.output;

  return (
    <div className="text-xs flex gap-2">
      <div className="flex-shrink-0">
        {getLogIcon(log.status)}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium text-foreground/90 leading-tight">
          {log.action.name}
        </div>
        {outputText && (
          <div className="text-muted-foreground leading-relaxed break-words text-pretty whitespace-pre-wrap">
            {/* 移除以下 Unicode 范围内的所有 emoji */}
            {outputText.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim()}
          </div>
        )}
      </div>
    </div>
  );
}
