import { useState } from 'react';
import { Zap, FileCode, Settings, Bot } from 'lucide-react';
import { Tabs } from '../components/Tabs';
import { TaskTab } from '../components/task';
import { AgentTab } from '../components/agent/AgentTab';
import { ScriptsTab } from '../components/scripts/ScriptsTab';
import { SettingsPanel } from '../components/shared/SettingsPanel';

const TAB_ID = {
  TASK: 'task',
  AGENT: 'agent',
  SCRIPTS: 'scripts',
} as const;

type TabId = typeof TAB_ID[keyof typeof TAB_ID];

function App() {
  const [activeTab, setActiveTab] = useState<TabId>(TAB_ID.TASK);
  const [showSettings, setShowSettings] = useState(false);

  const tabs = [
    { id: TAB_ID.TASK, label: 'Task', icon: <Zap size={14} /> },
    { id: TAB_ID.AGENT, label: 'Agent', icon: <Bot size={14} /> },
    { id: TAB_ID.SCRIPTS, label: 'Scripts', icon: <FileCode size={14} /> },
  ];

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex justify-between items-center px-4 py-2">
        <h1 className="text-lg font-bold text-slate-800">Pilot</h1>
        <button
          onClick={handleOpenSettings}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          title="设置"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Tabs */}
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onChange={(id) => setActiveTab(id as TabId)} 
      />

      {/* Tab Content - 使用 CSS 隐藏保持状态 */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 ${activeTab === TAB_ID.TASK ? '' : 'hidden'}`}>
          <TaskTab onOpenSettings={handleOpenSettings} />
        </div>
        <div className={`absolute inset-0 ${activeTab === TAB_ID.AGENT ? '' : 'hidden'}`}>
          <AgentTab />
        </div>
        <div className={`absolute inset-0 ${activeTab === TAB_ID.SCRIPTS ? '' : 'hidden'}`}>
          <ScriptsTab onOpenSettings={handleOpenSettings} />
        </div>
      </div>

      {/* Global Settings Modal */}
      {showSettings && <SettingsPanel onClose={handleCloseSettings} />}
    </div>
  );
}

export default App;
