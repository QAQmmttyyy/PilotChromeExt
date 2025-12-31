import { Copy } from 'lucide-react';

interface PromptDisplayProps {
  prompt: string;
  onCopyToInput?: (text: string) => void;
  showLabel?: boolean;
}

export function PromptDisplay({ prompt, onCopyToInput, showLabel = true }: PromptDisplayProps) {
  return (
    <div>
      {(showLabel || onCopyToInput) && (
        <div className="flex items-center justify-between mb-1">
          {showLabel && (
            <span className="text-sm font-medium text-slate-600">任务描述</span>
          )}
          {onCopyToInput && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopyToInput(prompt);
              }}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-purple-600 transition-colors"
              title="添加到输入框"
            >
              <Copy size={12} />
              填入输入框
            </button>
          )}
        </div>
      )}
      <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-2 whitespace-pre-wrap break-words">
        {prompt}
      </div>
    </div>
  );
}

