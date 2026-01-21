export interface Conversation {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workflow Execution Output - the complete execution state stored in tool output
export interface ExecuteWorkflowOutput {
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  totalSteps: number;
  currentStep: number;
  error?: string;
  steps: WorkflowStepState[];
}

export interface WorkflowStepState {
  stepIndex: number;
  stepName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  url?: string;
  error?: string;
  instruction?: string;
  pageAgentLogs?: PageAgentLogEntry[];
}

export interface PageAgentLogEntry {
  timestamp: number;
  action: string;
  status: 'pending' | 'success' | 'error';
  stepNumber?: number;
  details?: string;
  result?: string | Record<string, unknown>;
  metadata?: {
    actionName?: string;
    input?: string | Record<string, unknown>;
    thinking?: string;
    usage?: {
      tokens?: number;
      cached?: number;
    };
  };
}

// Chrome message types for workflow execution
export interface WorkflowProgressMessage {
  type: 'WORKFLOW_PROGRESS';
  payload: {
    toolCallId: string;
    stepIndex: number;
    stepName: string;
    status: 'starting' | 'running' | 'completed' | 'failed';
    url?: string;
    error?: string;
    instruction?: string;
    timestamp: number;
  };
}

export interface PageAgentLogMessage {
  type: 'PAGEAGENT_LOG';
  payload: {
    toolCallId: string;
    stepIndex: number;
    timestamp: number;
    action: string;
    status: 'pending' | 'success' | 'error';
    stepNumber?: number;
    details?: string;
    result?: unknown;
    metadata?: {
      actionName?: string;
      input?: unknown;
      thinking?: string;
      usage?: {
        tokens?: number;
        cached?: number;
      };
    };
  };
}

export interface WorkflowStatusMessage {
  type: 'WORKFLOW_STATUS_UPDATE';
  payload: {
    toolCallId: string;
    tabId?: number;
    status: 'completed' | 'failed';
    error?: string;
    data?: unknown;
  };
}
