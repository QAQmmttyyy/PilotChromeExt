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
}

