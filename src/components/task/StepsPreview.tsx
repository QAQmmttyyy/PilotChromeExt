import { RecordedStep } from '../../lib/types';
import { StepIcon } from '../shared/StepIcon';

interface StepsPreviewProps {
  steps: RecordedStep[];
  compact?: boolean;
}

export function StepsPreview({ steps, compact = false }: StepsPreviewProps) {
  if (steps.length === 0) return null;

  return (
    <div className={`grid grid-cols-[auto_auto_1fr] ${compact ? "gap-y-0.5" : "gap-y-1"}`}>
      {steps.map((step, idx) => (
        <div 
          key={step.id} 
          className={`grid grid-cols-subgrid col-span-3 gap-x-2 items-start text-sm ${compact ? 'py-1' : 'p-2 bg-slate-50 rounded-lg'}`}
        >
          <span className="h-4 flex items-center justify-end text-slate-400 text-xs">{idx + 1}.</span>
          <span className="h-4 flex items-center">
            <StepIcon type={step.type} />
          </span>
          <span className="text-slate-700 text-xs">
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

