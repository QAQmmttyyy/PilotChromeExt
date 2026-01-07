import { AIConfig, AVAILABLE_MODELS } from './ai';

const SETTINGS_KEY = 'pilot_settings';

export interface PilotSettings {
  ai: {
    apiKey: string;
    model: string;
    endpoint: string;
  };
  agentServerUrl: string;
}

const DEFAULT_SETTINGS: PilotSettings = {
  ai: {
    apiKey: '',
    model: AVAILABLE_MODELS[0].id,
    endpoint: 'https://openrouter.ai/api/v1/chat/completions'
  },
  agentServerUrl: 'http://localhost:3000'
};

export const settings = {
  get: async (): Promise<PilotSettings> => {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    const stored = result[SETTINGS_KEY] as Partial<PilotSettings> | undefined;
    return {
      ai: {
        apiKey: stored?.ai?.apiKey ?? DEFAULT_SETTINGS.ai.apiKey,
        model: stored?.ai?.model ?? DEFAULT_SETTINGS.ai.model,
        endpoint: stored?.ai?.endpoint ?? DEFAULT_SETTINGS.ai.endpoint
      },
      agentServerUrl: stored?.agentServerUrl ?? DEFAULT_SETTINGS.agentServerUrl
    };
  },

  set: async (newSettings: Partial<PilotSettings>): Promise<void> => {
    const current = await settings.get();
    const merged: PilotSettings = {
      ai: {
        apiKey: newSettings.ai?.apiKey ?? current.ai.apiKey,
        model: newSettings.ai?.model ?? current.ai.model,
        endpoint: newSettings.ai?.endpoint ?? current.ai.endpoint
      },
      agentServerUrl: newSettings.agentServerUrl ?? current.agentServerUrl
    };
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  },

  getAIConfig: async (): Promise<AIConfig> => {
    const s = await settings.get();
    return s.ai;
  },

  setAIConfig: async (config: Partial<AIConfig>): Promise<void> => {
    const current = await settings.get();
    await settings.set({
      ai: {
        apiKey: config.apiKey ?? current.ai.apiKey,
        model: config.model ?? current.ai.model,
        endpoint: config.endpoint ?? current.ai.endpoint
      }
    });
  },

  hasApiKey: async (): Promise<boolean> => {
    const s = await settings.get();
    return !!s.ai.apiKey;
  },

  getServerUrl: async (): Promise<string> => {
    const s = await settings.get();
    return s.agentServerUrl;
  }
};

export const getSettings = settings.get;
