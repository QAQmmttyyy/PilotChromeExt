import { RecordedStep } from './types';

export interface Script {
  id: string;
  name: string;
  description: string;
  code: string;
  steps?: RecordedStep[];
  createdAt: number;
  updatedAt: number;
}

export const storage = {
  getScripts: async (): Promise<Script[]> => {
    const result = await chrome.storage.local.get('scripts');
    return (result.scripts as Script[]) || [];
  },

  saveScript: async (script: Script): Promise<void> => {
    const scripts = await storage.getScripts();
    const existingIndex = scripts.findIndex(s => s.id === script.id);
    
    if (existingIndex >= 0) {
      scripts[existingIndex] = script;
    } else {
      scripts.push(script);
    }
    
    await chrome.storage.local.set({ scripts });
  },

  deleteScript: async (id: string): Promise<void> => {
    const scripts = await storage.getScripts();
    const newScripts = scripts.filter(s => s.id !== id);
    await chrome.storage.local.set({ scripts: newScripts });
  },
  
  getScript: async (id: string): Promise<Script | undefined> => {
    const scripts = await storage.getScripts();
    return scripts.find(s => s.id === id);
  }
};

