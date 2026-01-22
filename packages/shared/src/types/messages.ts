import type { AgentHistory } from 'page-agent';

export interface Conversation {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workflow Execution Output - the complete execution state stored in tool output
// Note: 'pending' state is removed - workflow starts as 'running' once initialized
export interface ExecuteWorkflowOutput {
  status: 'running' | 'completed' | 'failed';
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
  status: 'pending' | 'running' | 'completed' | 'failed';  // Keep 'pending' for individual steps
  startTime?: number;
  endTime?: number;
  url?: string;
  error?: string;
  instruction?: string;
  pageAgentLogs?: PageAgentLogEntry[];
}

export interface PageAgentLogEntry {
  timestamp: number;
  status: 'pending' | 'success' | 'error';
  stepNumber: number;
  action: AgentHistory['action'];
  usage?: AgentHistory['usage'];
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
    log: PageAgentLogEntry;
  };
}

// Window message types (Main World <-> Isolated World)
export interface PageAgentWindowMessage {
  source: 'PILOT_PAGEAGENT';
  type: 'PAGEAGENT_STEP';
  payload: PageAgentLogEntry;
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
