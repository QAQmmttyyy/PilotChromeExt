/// <reference types="vite/client" />

// Global interface extension for Pilot
interface Window {
  Pilot?: {
    openTab: (url: string) => void;
    log: (msg: string) => void;
    setData: (key: string, value: any) => void;
    getData: (key: string) => void;
    workflow: {
      next: (data?: any) => void;
      finish: () => void;
      fail: (reason: string) => void;
    };
    waitFor: (selector: string, timeout?: number) => Promise<Element>;
  };
  PilotData?: Record<string, any>;
}
