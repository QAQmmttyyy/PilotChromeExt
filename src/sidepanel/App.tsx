import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, ArrowLeft, Save, Sparkles } from 'lucide-react';
import { Script, storage } from '../lib/storage';

// Seed data logic
const SEED_SCRIPT: Script = {
  id: 'boss-auto-reply',
  name: 'Boss直聘自动回复',
  description: '自动回复打招呼消息',
  code: `// 这是一个示例脚本
// 目标: Boss直聘聊天窗口

function autoReply() {
  const chatInput = document.querySelector('.chat-input');
  // 注意：实际 DOM 结构可能随网站更新而变化
  // 这里仅为示例
  if (chatInput) {
    // 模拟输入
    chatInput.textContent = "你好，我对这个职位很感兴趣，这是我的简历。";
    chatInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log('Pilot: 已填入自动回复');
    
    // 找到发送按钮并点击 (慎用自动点击)
    // const sendBtn = document.querySelector('.btn-send');
    // if(sendBtn) sendBtn.click();
  } else {
    console.log('Pilot: 未找到聊天输入框');
  }
}

autoReply();`,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

function App() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    let savedScripts = await storage.getScripts();
    if (savedScripts.length === 0) {
      await storage.saveScript(SEED_SCRIPT);
      savedScripts = [SEED_SCRIPT];
    }
    setScripts(savedScripts);
  };

  const handleCreateNew = () => {
    const newScript: Script = {
      id: crypto.randomUUID(),
      name: 'New Script',
      description: 'Created by Pilot',
      code: '// Start typing or ask AI to generate code...',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setCurrentScript(newScript);
    setView('editor');
  };

  const handleEdit = (script: Script) => {
    setCurrentScript(script);
    setView('editor');
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this script?')) {
      await storage.deleteScript(id);
      loadScripts();
    }
  };

  const handleSave = async () => {
    if (currentScript) {
      const updatedScript = { ...currentScript, updatedAt: Date.now() };
      await storage.saveScript(updatedScript);
      setScripts(prev => {
        const idx = prev.findIndex(s => s.id === updatedScript.id);
        if (idx >= 0) {
          const newScripts = [...prev];
          newScripts[idx] = updatedScript;
          return newScripts;
        }
        return [...prev, updatedScript];
      });
      // Don't switch view, just notify save
      // alert('Saved!'); 
    }
  };

  const handleRun = async (script: Script) => {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) return;

    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || !tab.url) {
      alert('无法在扩展页面或浏览器系统页面运行脚本。\n请打开一个真实的网页（如 boss直聘）再试。');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          try {
             const run = new Function(code);
             run();
          } catch (e) {
             const s = document.createElement('script');
             s.textContent = code;
             (document.head || document.documentElement).appendChild(s);
             s.remove();
          }
        },
        args: [script.code],
        world: 'MAIN'
      });
    } catch (err) {
      console.error('Failed to execute script:', err);
      alert('Failed to execute script. Check console for details.');
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    
    // Simulate AI delay
    setTimeout(() => {
      const mockCode = `// AI Generated Code for: ${aiPrompt}\n\nconsole.log("Hello from AI! I heard you want: ${aiPrompt}");\n// TODO: Implement actual logic`;
      
      if (currentScript) {
        setCurrentScript({
          ...currentScript,
          code: currentScript.code + '\n\n' + mockCode
        });
      }
      setIsGenerating(false);
      setAiPrompt('');
    }, 1500);
  };

  if (view === 'editor' && currentScript) {
    return (
      <div className="h-screen w-full bg-gray-50 flex flex-col">
        <header className="p-3 bg-white border-b border-gray-200 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button onClick={() => { loadScripts(); setView('list'); }} className="p-1 hover:bg-gray-100 rounded">
              <ArrowLeft size={20} />
            </button>
            <input 
              value={currentScript.name} 
              onChange={e => setCurrentScript({...currentScript, name: e.target.value})}
              className="font-bold text-gray-800 bg-transparent border-none focus:ring-0 w-40"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleRun(currentScript)}
              className="p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
              title="Run on current tab"
            >
              <Play size={18} />
            </button>
            <button 
              onClick={handleSave}
              className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100"
              title="Save"
            >
              <Save size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white">
            <textarea
              className="flex-1 w-full p-4 font-mono text-sm resize-none focus:outline-none"
              value={currentScript.code}
              onChange={e => setCurrentScript({...currentScript, code: e.target.value})}
              spellCheck={false}
              placeholder="// Write your javascript code here..."
            />
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-purple-600" />
              <span className="text-xs font-semibold text-purple-600">AI Assistant</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Ask AI to edit this script..."
                className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-purple-400"
                onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
              />
              <button 
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {isGenerating ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col">
      <header className="p-4 bg-white border-b border-gray-200 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-800">Pilot Scripts</h1>
        <button 
          onClick={handleCreateNew}
          className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-md"
        >
          <Plus size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3">
        {scripts.map(script => (
          <div 
            key={script.id} 
            onClick={() => handleEdit(script)}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{script.name}</h3>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button 
                  onClick={() => handleRun(script)}
                  className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                  title="Run now"
                >
                  <Play size={16} />
                </button>
                <button 
                  onClick={(e) => handleDelete(e, script.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500 line-clamp-2">{script.description || 'No description'}</p>
            <div className="mt-2 text-xs text-gray-400">
              Updated: {new Date(script.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
        {scripts.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <p>No scripts yet. Create one!</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
