import { useEffect, useRef } from "react";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import type { UIMessagePart, UIDataTypes, UITools, ToolUIPart } from "ai";
import { isToolOrDynamicToolUIPart, getToolOrDynamicToolName } from "ai";
import { extractExecutedToolIds } from "./utils";
import type { 
  ExecuteWorkflowOutput, 
  WorkflowStepState, 
  AgentTools,
  ExecuteWorkflowToolPart
} from "@pilot/shared";

type SetMessages = (
  messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
) => void;

function isExecuteWorkflowPart(part: ToolUIPart<AgentTools>): part is ExecuteWorkflowToolPart {
  return getToolOrDynamicToolName(part) === 'executeWorkflow';
}

export function useWorkflowExecution(
  messages: UIMessage[],
  initialMessages: UIMessage[],
  setMessages: SetMessages,
  addToolOutput: UseChatHelpers<UIMessage>["addToolOutput"],
) {
  const executedToolIdsRef = useRef<Set<string>>(
    extractExecutedToolIds(initialMessages),
  );

  // Detect executeWorkflow tool calls (client-side tool) and trigger execution
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "assistant" && lastMsg.parts) {
      lastMsg.parts.forEach(async (messagePart) => {
        if (!isToolOrDynamicToolUIPart(messagePart)) return;

        const part = messagePart as ToolUIPart<AgentTools>;
        
        if (!isExecuteWorkflowPart(part)) return;
        if (executedToolIdsRef.current.has(part.toolCallId)) return;
        if (part.state !== "input-available") return;

        const { toolCallId, input } = part;
        const script = input.script;

        executedToolIdsRef.current.add(toolCallId);

        try {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (!tab?.id) {
            throw new Error("No active tab found");
          }

          // Initialize tool output with execution state (including tabId)
          const initialOutput: ExecuteWorkflowOutput = {
            status: "running",
            startTime: Date.now(),
            totalSteps: 0,
            currentStep: 0,
            steps: [],
            tabId: tab.id,
          };

          // Update tool part to show execution state
          setMessages((prevMessages) => {
            return prevMessages.map((msg) => {
              if (msg.id !== lastMsg.id) return msg;
              return {
                ...msg,
                parts: msg.parts.map((p: any) => {
                  if (p.toolCallId === toolCallId) {
                    // Replace args with execution output
                    return {
                      ...p,
                      state: "output-available",
                      output: initialOutput,
                    };
                  }
                  return p;
                }),
              };
            });
          });

          console.log(
            "[useWorkflowExecution] Starting workflow in tab:",
            tab.id,
          );
          await chrome.runtime.sendMessage({
            type: "START_WORKFLOW",
            payload: {
              script,
              tabId: tab.id,
              toolCallId,
            },
          });
        } catch (err) {
          console.error("Failed to execute workflow:", err);
          
          // Get tabId if available from error case
          let tabId: number | undefined;
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = tab?.id;
          } catch {}
          
          const failedOutput: ExecuteWorkflowOutput = {
            status: "failed",
            startTime: Date.now(),
            totalSteps: 0,
            currentStep: 0,
            steps: [],
            tabId,
            error: err instanceof Error ? err.message : String(err),
            endTime: Date.now(),
          };

          updateToolOutput(setMessages, lastMsg.id, toolCallId, failedOutput);

          // Call addToolOutput to mark as failed
          addToolOutput({
            tool: "executeWorkflow",
            toolCallId,
            output: failedOutput as never,
            state: "output-error",
            errorText: err instanceof Error ? err.message : String(err),
          });
        }
      });
    }
  }, [messages, setMessages, addToolOutput]);

  // Listen for workflow progress messages
  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log(
        "[useWorkflowExecution] Received message:",
        message.type,
        message.payload,
      );

      if (message.type === "WORKFLOW_PROGRESS") {
        const {
          toolCallId,
          tabId,
          stepIndex,
          stepName,
          status,
          url,
          error,
          instruction,
          timestamp,
        } = message.payload;

        setMessages((prevMessages) => {
          return prevMessages.map((msg) => {
            if (msg.role !== "assistant") return msg;

            return {
              ...msg,
              parts: msg.parts.map((part) => {
                if (!isToolOrDynamicToolUIPart(part) || part.toolCallId !== toolCallId)
                  return part;

                const output =
                  (part.output as ExecuteWorkflowOutput) ||
                  createInitialOutput();
                const newOutput = { 
                  ...output, 
                  steps: [...output.steps],
                  tabId: tabId || output.tabId
                };

                // Ensure steps array is long enough
                while (newOutput.steps.length <= stepIndex) {
                  newOutput.steps.push(createEmptyStep(newOutput.steps.length));
                }

                // Update step
                const step = { ...newOutput.steps[stepIndex] };
                step.stepName = stepName;
                step.status = status === "starting" ? "running" : status;
                step.url = url;
                step.error = error;
                step.instruction = instruction;

                if (status === "starting") {
                  step.startTime = timestamp;
                } else if (status === "completed" || status === "failed") {
                  step.endTime = timestamp;
                }

                newOutput.steps[stepIndex] = step;

                // Update overall status (already running, no need to check pending)
                newOutput.currentStep = stepIndex;
                newOutput.totalSteps = newOutput.steps.length;

                return { ...part, output: newOutput } as UIMessagePart<UIDataTypes, UITools>;
              }) as UIMessagePart<UIDataTypes, UITools>[],
            };
          });
        });
      }

      // PageAgent logs
      if (message.type === "PAGEAGENT_LOG") {
        console.log("[useWorkflowExecution] PageAgent log:", message.payload);
        const { toolCallId, tabId, stepIndex, log } = message.payload;

        setMessages((prevMessages) => {
          return prevMessages.map((msg) => {
            if (msg.role !== "assistant") return msg;

            return {
              ...msg,
              parts: msg.parts.map((part) => {
                if (!isToolOrDynamicToolUIPart(part) || part.toolCallId !== toolCallId)
                  return part;

                const output =
                  (part.output as ExecuteWorkflowOutput) ||
                  createInitialOutput();

                const newOutput = { 
                  ...output, 
                  steps: [...output.steps],
                  tabId: tabId || output.tabId
                };

                // Ensure steps array is long enough
                while (newOutput.steps.length <= stepIndex) {
                  newOutput.steps.push(createEmptyStep(newOutput.steps.length));
                }

                const step = { ...newOutput.steps[stepIndex] };
                step.pageAgentLogs = [...(step.pageAgentLogs || []), log];
                newOutput.steps[stepIndex] = step;

                // Update totalSteps if needed
                newOutput.totalSteps = Math.max(
                  newOutput.totalSteps,
                  newOutput.steps.length,
                );

                return { ...part, output: newOutput } as UIMessagePart<UIDataTypes, UITools>;
              }) as UIMessagePart<UIDataTypes, UITools>[],
            };
          });
        });
      }

      // Workflow completed/failed
      if (message.type === "WORKFLOW_STATUS_UPDATE") {
        const { toolCallId, status, error, tabId } = message.payload;

        console.log("[useWorkflowExecution] WORKFLOW_STATUS_UPDATE:", {
          toolCallId,
          status,
          error,
          tabId,
        });

        if (!toolCallId) {
          console.error(
            "[useWorkflowExecution] Empty toolCallId in WORKFLOW_STATUS_UPDATE!",
          );
          return;
        }

        let finalOutput: ExecuteWorkflowOutput | null = null;

        setMessages((prevMessages) => {
          return prevMessages.map((msg) => {
            if (msg.role !== "assistant") return msg;

            return {
              ...msg,
              parts: msg.parts.map((part) => {
                if (!isToolOrDynamicToolUIPart(part) || part.toolCallId !== toolCallId)
                  return part;

                const output =
                  (part.output as ExecuteWorkflowOutput) ||
                  createInitialOutput();
                const newOutput: ExecuteWorkflowOutput = {
                  ...output,
                  status,
                  endTime: Date.now(),
                  error: error || output.error,
                  tabId: tabId || output.tabId,
                };

                finalOutput = newOutput;
                console.log(
                  "[useWorkflowExecution] Updating tool output to:",
                  newOutput,
                );

                // Update part state and errorText for unified error handling
                return {
                  ...part,
                  output: newOutput,
                  state:
                    status === "failed" ? "output-error" : "output-available",
                  errorText:
                    status === "failed"
                      ? error || "Workflow execution failed"
                      : undefined,
                } as UIMessagePart<UIDataTypes, UITools>;
              }) as UIMessagePart<UIDataTypes, UITools>[],
            };
          });
        });

        // Call addToolOutput with complete ExecuteWorkflowOutput
        if (finalOutput) {
          console.log(
            "[useWorkflowExecution] Calling addToolOutput with ExecuteWorkflowOutput:",
            finalOutput,
          );

          if (status === "failed") {
            addToolOutput({
              tool: "executeWorkflow",
              toolCallId,
              output: finalOutput as never,
              state: "output-error",
              errorText: error || "Workflow execution failed",
            });
          } else {
            addToolOutput({
              tool: "executeWorkflow",
              toolCallId,
              output: finalOutput,
              state: "output-available",
            });
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [setMessages, addToolOutput]);
}

function createInitialOutput(): ExecuteWorkflowOutput {
  return {
    status: "running",
    startTime: Date.now(),
    totalSteps: 0,
    currentStep: 0,
    steps: [],
  };
}

function createEmptyStep(index: number): WorkflowStepState {
  return {
    stepIndex: index,
    stepName: "",
    status: "pending",
  };
}

function updateToolOutput(
  setMessages: SetMessages,
  messageId: string,
  toolCallId: string,
  output: ExecuteWorkflowOutput,
) {
  setMessages((prevMessages) => {
    return prevMessages.map((msg) => {
      if (msg.id !== messageId) return msg;
      return {
        ...msg,
        parts: msg.parts.map((part: any) => {
          if (part.toolCallId === toolCallId) {
            return {
              ...part,
              output,
              state:
                output.status === "failed"
                  ? "output-error"
                  : "output-available",
              errorText:
                output.status === "failed"
                  ? output.error || "Workflow execution failed"
                  : undefined,
            };
          }
          return part;
        }),
      };
    });
  });
}
