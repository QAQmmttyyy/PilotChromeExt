export interface WorkflowStep {
  id: string;
  name: string;
  url?: string; // Only used for explicit "navigate" steps
  waitId?: number; // 内部使用：等待的 Tab ID
  code: string; // 此步骤要执行的代码
  isAiStep?: boolean; // AI step 标记，用于控制 SPA 导航行为
  instruction?: string; // AI step 的原始操作指令描述
}

// ============== Ready Event Types ==============

export type ReadyEventType = 
  | 'CONTENT_SCRIPT_READY'    // Isolated World 脚本加载完成
  | 'PAGE_AGENT_READY'         // PageAgent 实例初始化完成
  | 'PAGE_FULLY_READY';        // 页面完全就绪（所有条件满足）

export interface ReadyEvent {
  type: ReadyEventType;
  tabId: number;
  timestamp: number;
}

// ============== Workflow Types ==============

export interface WorkflowContext {
  currentStepIndex: number;
  data: Record<string, any>; // 用于步骤间传递数据
  steps: WorkflowStep[];
  tabId: number | null;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  executingUrl?: string; // 当前步骤执行前的 URL，用于检测导航
  toolCallId?: string; // AI SDK tool call ID for tracking
}

// ============== Recording Types ==============

export type RecordedStepType = 'click' | 'input' | 'navigate' | 'submit' | 'select' | 'keypress' | 'ai_step';

export interface RecordedElement {
  tag: string;
  text: string;
  selectors: string[];
  attributes: Record<string, string>;
  boundingRect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface RecordedStep {
  id: string;
  timestamp: number;
  type: RecordedStepType;
  url: string;
  pageTitle: string;
  element?: RecordedElement;
  value?: string;
  key?: string;
}

export interface RecordingSession {
  id: string;
  scriptId: string; // 关联的脚本 ID
  name: string;
  startUrl: string;
  startTime: number;
  steps: RecordedStep[];
  status: 'recording' | 'paused' | 'stopped';
  tabId: number;
}

// Recording 消息类型
export interface RecordingMessage {
  type: 'RECORDING_START' | 'RECORDING_STOP' | 'RECORDING_PAUSE' | 'RECORDING_STEP' | 'RECORDING_STATUS' | 'RECORDING_GET_SESSION' | 'RECORDING_DELETE_STEP' | 'RECORDING_CLEAR';
  payload?: any;
}

export interface RecordingStepPayload {
  type: RecordedStepType;
  url: string;
  pageTitle: string;
  element?: RecordedElement;
  value?: string;
  key?: string;
}

