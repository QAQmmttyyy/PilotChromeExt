import { RecordedStep } from '../../lib/types';
import { StepIcon } from './StepIcon';

interface StepsPreviewProps {
  steps: RecordedStep[];
  compact?: boolean;
}

export function StepsPreview({ steps, compact = false }: StepsPreviewProps) {
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

