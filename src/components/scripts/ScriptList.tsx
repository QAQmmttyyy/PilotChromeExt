import { Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Script } from '../../lib/storage';

interface ScriptListProps {
  scripts: Script[];
  hasApiKey: boolean;
  onEdit: (script: Script) => void;
  onRun: (script: Script) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onCreateNew: () => void;
}

export function ScriptList({
  scripts,
  hasApiKey,
  onEdit,
  onRun,
  onDelete,
  onCreateNew
}: ScriptListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {!hasApiKey && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-4 text-sm">
          <div className="flex items-center gap-2 font-semibold text-purple-800 mb-1">
            <Sparkles size={16} />
            配置 AI 开始使用
          </div>
          <p className="text-purple-600 text-xs">
            点击设置按钮，输入 OpenRouter API Key
          </p>
        </div>
      )}

      <button
        onClick={onCreateNew}
        className="w-full p-4 border-2 border-dashed border-slate-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-blue-600"
      >
        <Plus size={20} />
        <span className="font-medium">创建新脚本</span>
      </button>

      {scripts.map(script => (
        <div
          key={script.id}
          onClick={() => onEdit(script)}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-slate-800 group-hover:text-blue-600">{script.name}</h3>
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => onRun(script)}
                className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg"
              >
                <Play size={16} />
              </button>
              <button
                onClick={(e) => onDelete(e, script.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-500 line-clamp-2">{script.description || '无描述'}</p>
          <div className="mt-2 text-xs text-slate-400">
            {new Date(script.updatedAt).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}

