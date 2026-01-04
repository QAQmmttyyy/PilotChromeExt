import { useState, useEffect } from 'react';
import { X, Brain } from 'lucide-react';
import { settings } from '../../lib/settings';
import { AVAILABLE_MODELS } from '../../lib/ai';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settings.getAIConfig().then(config => {
      setApiKey(config.apiKey || '');
      setSelectedModel(config.model || AVAILABLE_MODELS[0].id);
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await settings.setAIConfig({ apiKey, model: selectedModel });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const groupedModels = AVAILABLE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MODELS>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">AI 设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              从 <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">openrouter.ai/keys</a> 获取
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">AI 模型</label>
            <div className="space-y-3">
              {Object.entries(groupedModels).map(([provider, models]) => (
                <div key={provider}>
                  <div className="text-xs font-semibold text-slate-400 mb-1">{provider}</div>
                  <div className="space-y-1">
                    {models.map(model => (
                      <label
                        key={model.id}
                        className={`flex items-center p-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedModel === model.id
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="model"
                          value={model.id}
                          checked={selectedModel === model.id}
                          onChange={() => setSelectedModel(model.id)}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-slate-700">{model.name}</span>
                            {model.thinking && <Brain size={12} className="text-purple-500" />}
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{model.context}</span>
                          </div>
                          <div className="text-xs text-slate-500">{model.description}</div>
                        </div>
                        {selectedModel === model.id && (
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-purple-600 text-white py-2.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
          >
            {isSaving ? '保存中...' : saved ? '✓ 已保存' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

