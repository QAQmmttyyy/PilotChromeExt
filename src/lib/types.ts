export interface WorkflowStep {
  id: string;
  name: string;
  url?: string; // 如果提供，引擎会先跳转到此 URL
  waitId?: number; // 内部使用：等待的 Tab ID
  code: string; // 此步骤要执行的代码
}

export interface WorkflowContext {
  currentStepIndex: number;
  data: Record<string, any>; // 用于步骤间传递数据
  steps: WorkflowStep[];
  tabId: number | null;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed';
  stepNavigating?: boolean; // 脚本触发了导航，等待新页面加载后自动推进
}

// ============== Recording Types ==============

export type RecordedStepType = 'click' | 'input' | 'navigate' | 'submit' | 'select' | 'keypress';

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

