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
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { WorkflowHeaderExtra, WorkflowContent, WorkflowFooter } from "@/components/agent/chat/WorkflowExecutionDisplay"
import type { ExecuteWorkflowOutput } from "@pilot/shared"
import type { ToolUIPart, DynamicToolUIPart } from "ai"
import { getToolOrDynamicToolName } from "ai"

export type ToolProps = {
  toolPart: ToolUIPart | DynamicToolUIPart
  defaultOpen?: boolean
  className?: string
}

const Tool = ({ toolPart, defaultOpen = false, className }: ToolProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const { state, input, output } = toolPart
  const toolName = getToolOrDynamicToolName(toolPart)
  const isWorkflow = toolName === 'executeWorkflow'
  const isPageAction = toolName === 'page_action'

  const getStateIcon = () => {
    switch (state) {
      case "output-available":
        return <CircleCheck className="h-4 w-4 text-green-500" />
      case "output-error":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "input-streaming":
      default:
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
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
        "border-border overflow-hidden rounded-lg border bg-card text-card-foreground",
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
                {toolName}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {(isWorkflow || isPageAction) && output ? (
                <WorkflowHeaderExtra output={output as ExecuteWorkflowOutput} />
              ) : null}
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
              <div className="text-muted-foreground text-sm text-center">
                Processing tool call...
              </div>
            )}

            {(
              <>
                {(isWorkflow || isPageAction) ? (
                  output && <WorkflowContent output={output as unknown as ExecuteWorkflowOutput} />
                ) : (
                  <>
                    {input && typeof input === 'object' && Object.keys(input).length > 0 && (
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
              <div className="flex items-start gap-2 rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950/30 dark:text-red-400">
                <span className="break-words">{toolPart.errorText}</span>
              </div>
            )}
          </div>
          {isWorkflow && output ? (
            <WorkflowFooter
              output={output as ExecuteWorkflowOutput}
              toolCallId={toolPart.toolCallId}
            />
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export { Tool }
