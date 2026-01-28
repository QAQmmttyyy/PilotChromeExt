import { useState } from 'react';
import { Settings } from 'lucide-react';
import { AgentTab } from '../components/agent/AgentTab';
import { SettingsPanel } from '../components/shared/SettingsPanel';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  const handleOpenSettings = () => setShowSettings(true);
  const handleCloseSettings = () => setShowSettings(false);

  return (
    <div className="h-dvh w-full bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 flex justify-between items-center px-4 py-2">
        <h1 className="text-lg font-bold text-slate-800">Pilot</h1>
        <button
          onClick={handleOpenSettings}
          className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          aria-label="设置"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AgentTab />
      </div>

      {/* Global Settings Modal */}
      {showSettings && <SettingsPanel onClose={handleCloseSettings} />}
    </div>
  );
}

export default App;
