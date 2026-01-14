import { useState, useEffect } from 'react';
import { X, Server, Star } from 'lucide-react';
import { settings } from '../../lib/settings';
import { AVAILABLE_MODELS } from '../../lib/ai';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
  const [serverUrl, setServerUrl] = useState('http://localhost:3000');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    settings.get().then(config => {
      setApiKey(config.ai.apiKey || '');
      // Validate that saved model exists in current list
      const savedModel = config.ai.model;
      const modelExists = AVAILABLE_MODELS.some(m => m.id === savedModel);
      setSelectedModel(modelExists ? savedModel : AVAILABLE_MODELS[0].id);
      setServerUrl(config.agentServerUrl || 'http://localhost:3000');
    });
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    await settings.set({ 
      ai: { apiKey, model: selectedModel, endpoint: 'https://openrouter.ai/api/v1/chat/completions' },
      agentServerUrl: serverUrl 
    });
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const recommendedModels = AVAILABLE_MODELS.filter(m => m.recommended);
  const otherModels = AVAILABLE_MODELS.filter(m => !m.recommended);

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-[90%] max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">设置</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <Server size={16} />
              Agent Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              Agent 对话模式使用此 Server（API Key 在 Server 端配置）
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-slate-500 mb-3">
              以下配置仅用于本地 Task 模式（非 Agent 对话）
            </p>
            
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
            <div className="space-y-4">
              {/* 推荐模型 */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-2">
                  <Star size={12} className="fill-emerald-500" />
                  推荐模型
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendedModels.map(model => (
                    <label
                      key={model.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-colors text-sm ${
                        selectedModel === model.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 hover:border-emerald-300 text-slate-600'
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
                      <Star size={10} className="text-emerald-500 fill-emerald-500" />
                      {model.name}
                    </label>
                  ))}
                </div>
              </div>

              {/* 其他模型 */}
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">其他模型</div>
                <div className="flex flex-wrap gap-2">
                  {otherModels.map(model => (
                    <label
                      key={model.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border cursor-pointer transition-colors text-sm ${
                        selectedModel === model.id
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
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
                      {model.name}
                    </label>
                  ))}
                </div>
              </div>
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
