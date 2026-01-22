import { useEffect, useRef } from 'react';
import type { UIMessage } from '@ai-sdk/react';
import { isToolPart, extractExecutedToolIds } from './utils';
import type {
  ExecuteWorkflowOutput,
  WorkflowStepState,
} from '@pilot/shared';

type SetMessages = (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
type AddToolResult = (params: { tool: string; toolCallId: string; output: unknown }) => void;

export function useWorkflowExecution(
  messages: UIMessage[],
  initialMessages: UIMessage[],
  setMessages: SetMessages,
  addToolResult: AddToolResult,
) {
  const executedToolIdsRef = useRef<Set<string>>(extractExecutedToolIds(initialMessages));

  // Detect executeWorkflow tool calls (client-side tool) and trigger execution
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'assistant' && lastMsg.parts) {
      lastMsg.parts.forEach(async (part: any) => {
        if (!isToolPart(part)) return;
        
        const toolName = part.toolName || (part.type?.startsWith('tool-') ? part.type.substring(5) : '');
        if (toolName !== 'executeWorkflow') return;
        if (executedToolIdsRef.current.has(part.toolCallId)) return;
        
        // Skip if input is still streaming (args not complete yet)
        if (part.state === 'input-streaming') {
          return;
        }
        
        // For client-side tools, only process when state is 'input-available' or 'call'
        if (part.state !== 'input-available' && part.state !== 'call') {
          return;
        }
        
        // Skip if already has execution output (from history/refresh)
        const currentOutput = part.output;
        const isExecutionOutput = currentOutput && 'status' in currentOutput && 'steps' in currentOutput;
        if (isExecutionOutput) {
          console.log('[useWorkflowExecution] Skipping already executed workflow:', part.toolCallId);
          executedToolIdsRef.current.add(part.toolCallId);
          return;
        }
        
        // part.args/input contains the script
        const toolCallId = part.toolCallId;
        const args = part.args || part.input;
        const script = args?.script;
        
        console.log('[useWorkflowExecution] Detected executeWorkflow tool call:', {
          toolCallId,
          state: part.state,
          hasArgs: !!args,
          hasScript: !!script,
          args
        });
        
        if (!script) {
          console.error('[useWorkflowExecution] No script in tool call args, part:', part);
          return;
        }
        
        executedToolIdsRef.current.add(toolCallId);
        
        // Initialize tool output with execution state
        const initialOutput: ExecuteWorkflowOutput = {
          status: 'running',  // Start as running, not pending
          startTime: Date.now(),
          totalSteps: 0,
          currentStep: 0,
          steps: [],
        };
        
        // Update tool part to show execution state
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.id !== lastMsg.id) return msg;
            return {
              ...msg,
              parts: msg.parts.map((p: any) => {
                if (p.toolCallId === toolCallId) {
                  // Replace args with execution output
                  return {
                    ...p,
                    state: 'output-available',
                    output: initialOutput,
                  };
                }
                return p;
              })
            };
          });
        });
        
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            console.log('[useWorkflowExecution] Starting workflow in tab:', tab.id);
            await chrome.runtime.sendMessage({
              type: 'START_WORKFLOW',
              payload: { 
                script, 
                tabId: tab.id,
                toolCallId,
              }
            });
          }
        } catch (err) {
          console.error('Failed to execute workflow:', err);
          const failedOutput: ExecuteWorkflowOutput = {
            ...initialOutput,
            status: 'failed',
            error: err instanceof Error ? err.message : String(err),
            endTime: Date.now(),
          };
          
          updateToolOutput(setMessages, lastMsg.id, toolCallId, failedOutput);
          
          // Call addToolResult to mark as failed
          addToolResult({
            tool: 'executeWorkflow',
            toolCallId,
            output: failedOutput,
          });
        }
      });
    }
  }, [messages, setMessages, addToolResult]);

  // Listen for workflow progress messages
  useEffect(() => {
    const handleMessage = (message: any) => {
      console.log('[useWorkflowExecution] Received message:', message.type, message.payload);
      
      if (message.type === 'WORKFLOW_PROGRESS') {
        const { toolCallId, stepIndex, stepName, status, url, error, instruction, timestamp } = message.payload;
        
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.role !== 'assistant') return msg;
            
            return {
              ...msg,
              parts: msg.parts.map((part: any) => {
                if (!isToolPart(part) || part.toolCallId !== toolCallId) return part;
                
                const output = (part.output as ExecuteWorkflowOutput) || createInitialOutput();
                const newOutput = { ...output, steps: [...output.steps] };
                
                // Ensure steps array is long enough
                while (newOutput.steps.length <= stepIndex) {
                  newOutput.steps.push(createEmptyStep(newOutput.steps.length));
                }
                
                // Update step
                const step = { ...newOutput.steps[stepIndex] };
                step.stepName = stepName;
                step.status = status === 'starting' ? 'running' : status;
                step.url = url;
                step.error = error;
                step.instruction = instruction;
                
                if (status === 'starting') {
                  step.startTime = timestamp;
                } else if (status === 'completed' || status === 'failed') {
                  step.endTime = timestamp;
                }
                
                newOutput.steps[stepIndex] = step;
                
                // Update overall status (already running, no need to check pending)
                newOutput.currentStep = stepIndex;
                newOutput.totalSteps = newOutput.steps.length;
                
                return { ...part, output: newOutput };
              })
            };
          });
        });
      }
      
      // PageAgent logs
      if (message.type === 'PAGEAGENT_LOG') {
        console.log('[useWorkflowExecution] PageAgent log:', message.payload);
        const { toolCallId, stepIndex, log } = message.payload;
        
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.role !== 'assistant') return msg;
            
            return {
              ...msg,
              parts: msg.parts.map((part: any) => {
                if (!isToolPart(part) || part.toolCallId !== toolCallId) return part;
                
                const output = part.output as ExecuteWorkflowOutput;
                if (!output || stepIndex >= output.steps.length) return part;
                
                const newOutput = { ...output, steps: [...output.steps] };
                const step = { ...newOutput.steps[stepIndex] };
                
                step.pageAgentLogs = [...(step.pageAgentLogs || []), log];
                newOutput.steps[stepIndex] = step;
                
                return { ...part, output: newOutput };
              })
            };
          });
        });
      }
      
      // Workflow completed/failed
      if (message.type === 'WORKFLOW_STATUS_UPDATE') {
        const { toolCallId, status, error } = message.payload;
        
        console.log('[useWorkflowExecution] WORKFLOW_STATUS_UPDATE:', { toolCallId, status, error });
        
        if (!toolCallId) {
          console.error('[useWorkflowExecution] Empty toolCallId in WORKFLOW_STATUS_UPDATE!');
          return;
        }
        
        let finalOutput: ExecuteWorkflowOutput | null = null;
        
        setMessages(prevMessages => {
          return prevMessages.map(msg => {
            if (msg.role !== 'assistant') return msg;
            
            return {
              ...msg,
              parts: msg.parts.map((part: any) => {
                if (!isToolPart(part) || part.toolCallId !== toolCallId) return part;
                
                const output = (part.output as ExecuteWorkflowOutput) || createInitialOutput();
                const newOutput: ExecuteWorkflowOutput = {
                  ...output,
                  status,
                  endTime: Date.now(),
                  error: error || output.error,
                };
                
                finalOutput = newOutput;
                console.log('[useWorkflowExecution] Updating tool output to:', newOutput);
                
                // Update part state and errorText for unified error handling
                return {
                  ...part,
                  output: newOutput,
                  state: status === 'failed' ? 'output-error' : 'output-available',
                  errorText: status === 'failed' ? (error || 'Workflow execution failed') : undefined,
                };
              })
            };
          });
        });
        
        // Call addToolResult with complete ExecuteWorkflowOutput
        if (finalOutput) {
          console.log('[useWorkflowExecution] Calling addToolResult with ExecuteWorkflowOutput:', finalOutput);
          addToolResult({
            tool: 'executeWorkflow',
            toolCallId,
            output: finalOutput,
          });
        }
      }
    };
    
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [setMessages, addToolResult]);
}

function createInitialOutput(): ExecuteWorkflowOutput {
  return {
    status: 'running',  // Start as running, not pending
    startTime: Date.now(),
    totalSteps: 0,
    currentStep: 0,
    steps: [],
  };
}

function createEmptyStep(index: number): WorkflowStepState {
  return {
    stepIndex: index,
    stepName: '',
    status: 'pending',
  };
}

function updateToolOutput(
  setMessages: SetMessages,
  messageId: string,
  toolCallId: string,
  output: ExecuteWorkflowOutput
) {
  setMessages(prevMessages => {
    return prevMessages.map(msg => {
      if (msg.id !== messageId) return msg;
      return {
        ...msg,
        parts: msg.parts.map((part: any) => {
          if (part.toolCallId === toolCallId) {
            return {
              ...part,
              output,
              state: output.status === 'failed' ? 'output-error' : 'output-available',
              errorText: output.status === 'failed' ? (output.error || 'Workflow execution failed') : undefined,
            };
          }
          return part;
        })
      };
    });
  });
}
