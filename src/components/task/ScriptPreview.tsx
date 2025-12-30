import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ScriptPreviewProps {
  script: string;
}

export function ScriptPreview({ script }: ScriptPreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (!script) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-slate-50 text-sm font-medium text-slate-600 hover:bg-slate-100"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
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

