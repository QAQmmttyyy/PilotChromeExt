import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  CircleCheck,
  ChevronDown,
  Loader2,
  Settings,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { WorkflowHeaderExtra, WorkflowContent } from "@/components/agent/chat/WorkflowExecutionDisplay"
import type { ExecuteWorkflowOutput } from "@pilot/shared"

export type ToolPart = {
  type: string
  toolName?: string
  state:
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error"
  | "call" // AI SDK may use 'call' state
  input?: Record<string, unknown>
  args?: Record<string, unknown> // AI SDK may use 'args' instead of 'input'
  output?: Record<string, unknown>
  toolCallId?: string
  errorText?: string
}

export type ToolProps = {
  toolPart: ToolPart
  defaultOpen?: boolean
  className?: string
}

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const { state, input, output, toolName } = toolPart

  const isWorkflow = toolName === 'executeWorkflow' || toolPart.type === 'executeWorkflow'

  const getStateIcon = () => {
    switch (state) {
      case "input-streaming":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case "input-available":
        return <Settings className="h-4 w-4 text-orange-500" />
      case "output-available":
        return <CircleCheck className="h-4 w-4 text-green-500" />
      case "output-error":
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Settings className="text-muted-foreground h-4 w-4" />
    }
  }

  const formatValue = (value: unknown): string => {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (typeof value === "string") return value
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  return (
    <div
      className={cn(
        "border-border mt-3 overflow-hidden rounded-lg border bg-card text-card-foreground",
        className
      )}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="bg-muted/30 h-auto w-full justify-between rounded-b-none px-3 py-2 font-normal hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0 flex-shrink">
              {getStateIcon()}
              <span className="font-mono text-sm font-medium truncate">
                {toolPart.type}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {isWorkflow && output && <WorkflowHeaderExtra output={output as unknown as ExecuteWorkflowOutput} />}
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent
          className={cn(
            "border-border border-t",
            "data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden"
          )}
        >
          <div className="bg-background space-y-3 p-3">
            {state === "input-streaming" && (
              <div className="text-muted-foreground text-sm">
                Processing tool call...
              </div>
            )}

            {state === "input-available" && (
              <div className="text-muted-foreground text-sm">
                Tool ready to execute
              </div>
            )}

            {(
              <>
                {isWorkflow ? (
                  output && <WorkflowContent output={output as unknown as ExecuteWorkflowOutput} />
                ) : (
                  <>
                    {input && Object.keys(input).length > 0 && (
                      <div>
                        <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                          Input
                        </h4>
                        <div className="bg-background rounded border p-2 font-mono text-sm">
                          {Object.entries(input).map(([key, value]) => (
                            <div key={key} className="mb-1">
                              <span className="text-muted-foreground">{key}:</span>{" "}
                              <span>{formatValue(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {output && (
                      <div>
                        <h4 className="text-muted-foreground mb-2 text-sm font-medium">
                          Output
                        </h4>
                        <div className="bg-background max-h-60 overflow-auto rounded border p-2 font-mono text-sm">
                          <pre className="whitespace-pre-wrap">
                            {formatValue(output)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {state === "output-error" && toolPart.errorText && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-red-500">Error</h4>
                <div className="bg-background rounded border border-red-200 p-2 text-sm dark:border-red-950 dark:bg-red-900/20">
                  {toolPart.errorText}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export { Tool }
