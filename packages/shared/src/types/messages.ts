import type { AgentHistory } from "page-agent";
import type { UITools, UIToolInvocation } from "ai";
import type { RecordedStep } from "./workflow";

export interface Conversation {
  id: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Workflow Execution Output - the complete execution state stored in tool output
// Note: 'pending' state is removed - workflow starts as 'running' once initialized
export interface ExecuteWorkflowOutput {
  status: "running" | "completed" | "failed";
  startTime: number;
  endTime?: number;
  totalSteps: number;
  currentStep: number;
  error?: string;
  steps: WorkflowStepState[];
  tabId?: number;
}

export interface WorkflowStepState {
  stepIndex: number;
  stepName: string;
  status: "pending" | "running" | "completed" | "failed"; // Keep 'pending' for individual steps
  startTime?: number;
  endTime?: number;
  url?: string;
  error?: string;
  instruction?: string;
  pageAgentLogs?: PageAgentLogEntry[];
}

export interface PageAgentLogEntry {
  timestamp: number;
  status: "pending" | "success" | "error";
  stepNumber: number;
  action: AgentHistory["action"];
  usage?: AgentHistory["usage"];
}

// Chrome message types for workflow execution
export interface WorkflowProgressMessage {
  type: "WORKFLOW_PROGRESS";
  payload: {
    toolCallId: string;
    tabId: number;
    stepIndex: number;
    stepName: string;
    status: "starting" | "running" | "completed" | "failed";
    url?: string;
    error?: string;
    instruction?: string;
    timestamp: number;
  };
}

export interface PageAgentLogMessage {
  type: "PAGEAGENT_LOG";
  payload: {
    toolCallId: string;
    tabId: number;
    stepIndex: number;
    log: PageAgentLogEntry;
  };
}

// Window message types (Main World <-> Isolated World)
export interface PageAgentWindowMessage {
  source: "PILOT_PAGEAGENT";
  type: "PAGEAGENT_STEP";
  payload: PageAgentLogEntry;
}

export interface WorkflowStatusMessage {
  type: "WORKFLOW_STATUS_UPDATE";
  payload: {
    toolCallId: string;
    tabId?: number;
    status: "completed" | "failed";
    error?: string;
    data?: unknown;
  };
}

// ============= Agent Tool Types =============

// GenerateSteps Tool
export interface GenerateStepsInput {
  task: string;
}

export interface GenerateStepsOutput {
  success: boolean;
  steps: RecordedStep[];
  error?: string;
}

// GenerateScript Tool
export interface GenerateScriptInput {
  steps: RecordedStep[];
}

export interface GenerateScriptOutput {
  success: boolean;
  script: string;
  error?: string;
}

// ExecuteWorkflow Tool
export interface ExecuteWorkflowInput {
  script: string;
}

// Complete Agent Tools Collection (using AI SDK UITools type)
export interface AgentTools extends UITools {
  generateSteps: {
    input: GenerateStepsInput;
    output: GenerateStepsOutput;
  };
  generateScript: {
    input: GenerateScriptInput;
    output: GenerateScriptOutput;
  };
  executeWorkflow: {
    input: ExecuteWorkflowInput;
    output: ExecuteWorkflowOutput;
  };
}

// Helper type to extract a specific tool's UI part
export type ToolPartOf<
  TOOLS extends UITools,
  NAME extends keyof TOOLS & string
> = { type: `tool-${NAME}` } & UIToolInvocation<TOOLS[NAME]>;

// Typed tool parts for direct use
export type ExecuteWorkflowToolPart = ToolPartOf<AgentTools, 'executeWorkflow'>;
