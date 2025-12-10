import { useState, useEffect } from 'react';
import { Play, Settings } from 'lucide-react';
import { Script, storage } from '../lib/storage';

function App() {
  const [scripts, setScripts] = useState<Script[]>([]);

  useEffect(() => {
    storage.getScripts().then(setScripts);
  }, []);

  const openSidePanel = async () => {
    // Try to open side panel
    try {
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow.id && chrome.sidePanel && chrome.sidePanel.open) {
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        window.close(); // Close popup if side panel opens successfully
      } else {
         // Fallback or just tell user to click the toolbar icon if configured
         chrome.tabs.create({ url: "src/sidepanel/index.html" });
      }
    } catch (err) {
      console.error(err);
      // Fallback
      chrome.tabs.create({ url: "src/sidepanel/index.html" });
    }
  };

  const handleRun = async (script: Script) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.id) return;
    
    // 检查是否在受限页面上
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://') || !tab.url) {
      alert('无法在扩展页面或浏览器系统页面运行脚本。\n请打开一个真实的网页（如 boss直聘）再试。');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          // 直接在 MAIN world (页面上下文) 中执行
          // 这里的 window 是页面的 window
          try {
             // 尝试使用 new Function 执行 (最快，但可能被严格的页面 CSP 拦截)
             const run = new Function(code);
             run();
          } catch (e) {
             console.log('Pilot: Direct eval failed, trying script injection fallback...');
             // 兜底方案：Script 标签注入 (即使在 Main World 也可能需要这个，如果页面 CSP 禁止 eval 但允许 inline)
             const script = document.createElement('script');
             script.textContent = code;
             (document.head || document.documentElement).appendChild(script);
             script.remove();
          }
        },
        args: [script.code],
        world: 'MAIN', // 关键：指定在页面上下文中运行
      });
      window.close();
    } catch (err) {
      console.error(err);
      alert('执行失败: ' + err);
    }
  };

  return (
    <div className="w-[320px] bg-gray-50 min-h-[200px] flex flex-col">
      <header className="p-3 bg-white border-b border-gray-200 flex justify-between items-center">
        <h1 className="font-bold text-gray-800">Pilot Scripts</h1>
        <button 
          onClick={openSidePanel}
          className="p-1.5 text-gray-500 hover:bg-gray-100 rounded transition-colors"
          title="Manage Scripts"
        >
          <Settings size={18} />
        </button>
      </header>

      <main className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[400px]">
        {scripts.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            No scripts found.<br/>Click settings to create one.
          </div>
        ) : (
          scripts.map(script => (
            <div 
              key={script.id}
              className="bg-white p-3 rounded-md shadow-sm border border-gray-200 flex justify-between items-center group hover:border-blue-300 transition-colors"
            >
              <div className="overflow-hidden">
                <h3 className="font-medium text-gray-800 truncate" title={script.name}>{script.name}</h3>
                <p className="text-xs text-gray-500 truncate">{script.description}</p>
              </div>
              <button 
                onClick={() => handleRun(script)}
                className="ml-2 p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                title="Run"
              >
                <Play size={14} />
              </button>
            </div>
          ))
        )}
      </main>
    </div>
  );
}

export default App;
