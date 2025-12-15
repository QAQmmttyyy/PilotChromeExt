import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, ArrowLeft, Save, Sparkles, Eye } from 'lucide-react';
import { Script, storage } from '../lib/storage';
import { parseScriptToWorkflow } from '../lib/parser';

// Seed data logic
const SEED_SCRIPT: Script = {
  id: 'baidu-google-workflow',
  name: '百度 -> Google 搜索',
  description: 'AI 生成的完整脚本示例：工具函数 + 业务逻辑',
  code: `// ============================================
// 工具函数（AI 根据需要生成）
// ============================================
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const el = document.querySelector(selector);
      if (el) {
        resolve(el);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(\`超时: 未找到元素 "\${selector}" (\${timeout}ms)\`));
      } else {
        setTimeout(check, 200);
      }
    };
    check();
  });
}

// ============================================
// === STEP: 在百度搜索 (https://www.baidu.com) ===
// ============================================
(async () => {
  try {
    console.log('[Step 1] 等待百度搜索框...');
    const input = await waitForElement('#kw, input[name="wd"]', 5000);
    
    console.log('[Step 1] ✓ 找到搜索框');
    input.value = "Chrome Extension Development";
    input.dispatchEvent(new Event('input', {bubbles: true}));
    
    const btn = await waitForElement('#su, input[type="submit"]', 3000);
    console.log('[Step 1] ✓ 点击搜索按钮');
    btn.click();
    
    // 通知 Pilot：步骤完成
    window.Pilot.workflow.next({ searchTerm: "Chrome Extension" });
  } catch (err) {
    window.Pilot.workflow.fail('百度首页: ' + err.message);
  }
})();

// ============================================
// === STEP: 提取百度结果 (https://www.baidu.com/s) ===
// ============================================
(async () => {
  try {
    console.log('[Step 2] 等待百度搜索结果...');
    const firstResult = await waitForElement('h3.c-title a, .result h3 a, .c-title a', 8000);
    
    const title = firstResult.innerText.trim();
    if (!title) {
      throw new Error('提取到的标题为空');
    }
    
    console.log('[Step 2] ✓ 提取到:', title);
    window.Pilot.workflow.next({ baiduTitle: title });
  } catch (err) {
    window.Pilot.workflow.fail('百度结果页: ' + err.message);
  }
})();

// ============================================
// === STEP: 去 Google 搜索 (https://www.google.com) ===
// ============================================
(async () => {
  try {
    const data = window.PilotData || {};
    const query = data.baiduTitle || data.searchTerm;
    
    if (!query) {
      throw new Error('没有从上一步获取到搜索词');
    }
    
    console.log('[Step 3] 等待 Google 搜索框...');
    const googleInput = await waitForElement('textarea[name="q"], input[name="q"]', 5000);
    
    googleInput.value = query;
    googleInput.dispatchEvent(new Event('input', {bubbles: true}));
    
    console.log('[Step 3] ✅ 完成！已填入:', query);
    alert(\`✅ Workflow 完成！\\n\\n从百度提取: \${query}\\n已填入 Google 搜索框\`);
    window.Pilot.workflow.finish();
  } catch (err) {
    window.Pilot.workflow.fail('Google 页面: ' + err.message);
  }
})();
`,
  createdAt: Date.now(),
  updatedAt: Date.now()
};

function App() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [scripts, setScripts] = useState<Script[]>([]);
  const [currentScript, setCurrentScript] = useState<Script | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pageContext, setPageContext] = useState<string>('');

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
      code: '// === STEP: Start (https://example.com) ===\n// Write your code here',
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
    }
  };

  const handleRun = async (script: Script) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) return;

    // 1. 解析脚本
    const workflowSteps = parseScriptToWorkflow(script.code);
    console.log('Parsed Workflow:', workflowSteps);
    
    const isWorkflow = workflowSteps.length > 1 || (workflowSteps.length === 1 && workflowSteps[0].url);

    // 2. 检查权限
    // 如果是普通单页脚本，必须在真实网页运行
    // 如果是 Workflow 且第一步指定了 URL，允许在任何页面运行（因为引擎会负责跳转）
    if (!isWorkflow) {
        if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || !tab.url) {
          alert('单页脚本无法在扩展页面运行。\n请打开一个真实的网页再试，或者在脚本第一行添加 "// === STEP: Name (https://...) ===" 来指定目标网址。');
          return;
        }
    }

    // 3. 发送给 Background 引擎
    try {
      await chrome.runtime.sendMessage({
        type: 'START_WORKFLOW',
        payload: { steps: workflowSteps, tabId: tab.id }
      });
      // 可选：如果是在 SidePanel，不一定要关闭。如果是在 Popup，通常会关闭。
    } catch (err) {
      console.error('Failed to start workflow:', err);
      alert('Failed to start workflow.');
    }
  };

  const capturePageContext = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) return;

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            const interactiveElements = Array.from(document.querySelectorAll('button, a, input, textarea, form'));
            const simplifiedDOM = interactiveElements.map(el => {
                const tag = el.tagName.toLowerCase();
                const id = el.id ? `#${el.id}` : '';
                const cls = Array.from(el.classList).map(c => `.${c}`).join('');
                const text = (el as HTMLElement).innerText?.slice(0, 50).replace(/\n/g, ' ') || '';
                return `${tag}${id}${cls} [text="${text}"]`;
            }).join('\n');
            
            return {
                title: document.title,
                url: window.location.href,
                dom: simplifiedDOM
            };
        }
      });
      
      if (results[0] && results[0].result) {
        const context = results[0].result;
        setPageContext(`Current Page: ${context.title}\nURL: ${context.url}\nInteractive Elements:\n${context.dom}`);
        setAiPrompt((prev) => prev ? prev : "帮我分析这个页面，写一个脚本...");
      }
    } catch (err) {
      console.error("Failed to capture context", err);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    
    const fullPrompt = `User Request: ${aiPrompt}\n\n${pageContext ? `Page Context (Use this to find selectors):\n${pageContext}` : ''}`;
    console.log("Sending to AI:", fullPrompt);

    // Simulate AI delay
    setTimeout(() => {
      let mockCode = `// AI Response\n`;
      const lowerPrompt = aiPrompt.toLowerCase();
      
      // 简单模拟 AI 生成分步脚本
      if (lowerPrompt.includes('google') && lowerPrompt.includes('bing')) {
          mockCode = `
// === STEP: Google Search (https://www.google.com) ===
const input = document.querySelector('input[name="q"]');
if(input) {
  input.value = "${aiPrompt.replace('google', '').replace('bing', '').trim()}";
  input.form.submit();
  window.Pilot.workflow.next();
}

// === STEP: Bing Search (https://www.bing.com) ===
const input = document.querySelector('input[name="q"]');
if(input) {
  input.value = "Result from Google";
  window.Pilot.workflow.finish();
}
`;
      } else {
          mockCode += `console.log("AI executed: ${aiPrompt}");`;
      }
      
      if (currentScript) {
        setCurrentScript({
          ...currentScript,
          code: currentScript.code + '\n\n' + mockCode
        });
      }
      setIsGenerating(false);
      setAiPrompt('');
    }, 1000);
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
              className="font-bold text-gray-800 bg-transparent border-none focus:ring-0 w-32 truncate"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleRun(currentScript)}
              className="p-2 text-blue-600 bg-blue-50 rounded hover:bg-blue-100 flex items-center gap-1"
              title="Run Workflow"
            >
              <Play size={18} />
              <span className="text-xs font-semibold">Run</span>
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
          <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden flex flex-col bg-white shadow-sm">
             <div className="bg-gray-100 px-4 py-1 text-xs text-gray-500 border-b border-gray-200 flex justify-between">
                <span>Workflow Editor</span>
                <span className="text-gray-400">Use // === STEP: Name (Url) === to split steps</span>
             </div>
            <textarea
              className="flex-1 w-full p-4 font-mono text-xs resize-none focus:outline-none leading-relaxed"
              value={currentScript.code}
              onChange={e => setCurrentScript({...currentScript, code: e.target.value})}
              spellCheck={false}
              placeholder="// === STEP: Step 1 === ..."
            />
          </div>
          
          <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-600" />
                <span className="text-xs font-semibold text-purple-600">AI Assistant</span>
                </div>
                
                <button 
                    onClick={capturePageContext}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded border bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                >
                    <Eye size={12} />
                    {pageContext ? 'Context Loaded' : 'Read Page'}
                </button>
            </div>
            
            <div className="flex gap-2">
              <input 
                type="text" 
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Describe your workflow..."
                className="flex-1 text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-purple-400"
                onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
              />
              <button 
                onClick={handleAiGenerate}
                disabled={isGenerating}
                className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
              >
                Send
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
      </main>
    </div>
  );
}

export default App;
