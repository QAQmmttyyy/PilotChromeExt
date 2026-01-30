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

// ============= New ReAct Tools =============

// PageAction Tool - PageAgent 托管执行页面操作
export interface PageActionInput {
  tabId: number;
  instruction: string;
}

export type PageActionOutput = ExecuteWorkflowOutput;

// Chrome API Tools - Split into individual tools for clearer parameters

export const CHROME_API_TOOLS = [
  "create_tab",
  "update_tab",
  "close_tab",
  "get_tab",
  "query_tabs",
  "capture_screenshot",
] as const;

export type ChromeApiToolName = (typeof CHROME_API_TOOLS)[number];

export interface CreateTabInput {
  url?: string;
  active?: boolean;
}

export interface UpdateTabInput {
  url?: string;
  tabId?: number;
  active?: boolean;
}

export interface CloseTabInput {
  tabId: number;
}

export interface GetTabInput {
  tabId?: number;
}

export interface QueryTabsInput {
  active?: boolean;
  currentWindow?: boolean;
}

export interface CaptureScreenshotInput {
  tabId?: number;
}

export interface ChromeApiOutput {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ChromeApiMessage {
  type: "EXECUTE_CHROME_API";
  payload: {
    toolCallId: string;
    script: string;
  };
}

export interface ChromeApiResultMessage {
  type: "CHROME_API_RESULT";
  payload: {
    toolCallId: string;
    output: ChromeApiOutput;
  };
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
  // New ReAct tools
  page_action: {
    input: PageActionInput;
    output: PageActionOutput;
  };
  // Chrome API tools
  create_tab: {
    input: CreateTabInput;
    output: ChromeApiOutput;
  };
  update_tab: {
    input: UpdateTabInput;
    output: ChromeApiOutput;
  };
  close_tab: {
    input: CloseTabInput;
    output: ChromeApiOutput;
  };
  get_tab: {
    input: GetTabInput;
    output: ChromeApiOutput;
  };
  query_tabs: {
    input: QueryTabsInput;
    output: ChromeApiOutput;
  };
  capture_screenshot: {
    input: CaptureScreenshotInput;
    output: ChromeApiOutput;
  };
}

// Helper type to extract a specific tool's UI part
export type ToolPartOf<
  TOOLS extends UITools,
  NAME extends keyof TOOLS & string,
> = { type: `tool-${NAME}` } & UIToolInvocation<TOOLS[NAME]>;

// Typed tool parts for direct use
export type ExecuteWorkflowToolPart = ToolPartOf<AgentTools, "executeWorkflow">;
export type PageActionToolPart = ToolPartOf<AgentTools, "page_action">;
