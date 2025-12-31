/// <reference types="vite/client" />

// Pilot API: Pure Bridge
interface Window {
  Pilot?: {
    // 浏览器能力
    openTab: (url: string) => void;
    log: (msg: string) => void;
    
    // 工作流控制（异步通信）
    workflow: {
      next: (data?: any) => void;
      finish: () => void;
      fail: (reason: string) => void;
    };
  };
  
  // 工作流引擎注入的跨步骤数据
  PilotData?: Record<string, any>;
}
