import { ArrowLeft, Play, Save } from 'lucide-react';
import { Script } from '../../lib/storage';

interface ScriptHeaderProps {
  script: Script;
  onUpdateName: (name: string) => void;
  onBack: () => void;
  onRun: () => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

export function ScriptHeader({
  script,
  onUpdateName,
  onBack,
  onRun,
  onSave,
  saveStatus
}: ScriptHeaderProps) {
  return (
    <header className="p-3 bg-white border-b border-slate-200 flex justify-between items-center">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-lg">
          <ArrowLeft size={18} />
        </button>
        <input
          value={script.name}
          onChange={e => onUpdateName(e.target.value)}
          className="font-semibold text-slate-800 bg-transparent border-none focus:ring-0 w-32"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={onRun}
          className="px-3 py-1.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1.5 text-sm font-medium"
        >
          <Play size={16} />
          运行
        </button>
        <button
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className={`p-2 rounded-lg flex items-center gap-1 text-sm transition-colors ${
            saveStatus === 'saved' ? 'text-green-600 bg-green-50' :
            saveStatus === 'error' ? 'text-red-600 bg-red-50' :
            saveStatus === 'saving' ? 'text-slate-400' :
            'text-green-600 hover:bg-green-50'
          }`}
          title="保存"
        >
          <Save size={18} />
          {saveStatus === 'saving' && <span className="text-xs">...</span>}
          {saveStatus === 'saved' && <span className="text-xs">✓</span>}
          {saveStatus === 'error' && <span className="text-xs">✗</span>}
        </button>
      </div>
    </header>
  );
}

