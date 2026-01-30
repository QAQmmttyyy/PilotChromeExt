import { useEffect, useRef } from "react";
import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";
import { isToolOrDynamicToolUIPart, getToolOrDynamicToolName } from "ai";
import { CHROME_API_TOOLS, type ChromeApiToolName, type ChromeApiOutput } from "@pilot/shared";
import { extractExecutedToolIds } from "./utils";

type SetMessages = (
  messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[]),
) => void;

function isChromeApiTool(toolName: string): toolName is ChromeApiToolName {
  return CHROME_API_TOOLS.includes(toolName as ChromeApiToolName);
}

export function useChromeApi(
  messages: UIMessage[],
  initialMessages: UIMessage[],
  setMessages: SetMessages,
  addToolOutput: UseChatHelpers<UIMessage>["addToolOutput"],
) {
  const executedToolIdsRef = useRef<Set<string>>(
    extractExecutedToolIds(initialMessages),
  );

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role !== "assistant" || !lastMsg.parts) return;

    lastMsg.parts.forEach(async (messagePart) => {
      if (!isToolOrDynamicToolUIPart(messagePart)) return;

      const part = messagePart;
      const toolName = getToolOrDynamicToolName(part);

      if (!isChromeApiTool(toolName)) return;
      if (executedToolIdsRef.current.has(part.toolCallId)) return;
      if (part.state !== "input-available") return;

      const { toolCallId, input } = part;
      const chromeToolName = toolName as ChromeApiToolName;

      executedToolIdsRef.current.add(toolCallId);

      console.log(
        "[useChromeApi] Executing tool:",
        chromeToolName,
        "params:",
        input,
      );

      const initialOutput: ChromeApiOutput = {
        success: true,
        data: "正在执行...",
      };

      setMessages((prev) =>
        updateToolPartState(prev, lastMsg.id, toolCallId, {
          state: "output-available",
          output: initialOutput,
        }),
      );

      chrome.runtime.sendMessage({
        type: "EXECUTE_CHROME_API",
        payload: { toolCallId, action: chromeToolName, params: input },
      });
    });
  }, [messages, setMessages]);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === "CHROME_API_RESULT") {
        const { toolCallId, output } = message.payload as {
          toolCallId: string;
          output: ChromeApiOutput;
        };

        const toolPart = findToolPartByCallId(messages, toolCallId);
        if (!toolPart) {
          console.warn("[useChromeApi] Tool part not found:", toolCallId);
          return;
        }

        const toolName = getToolOrDynamicToolName(toolPart);
        if (!isChromeApiTool(toolName)) {
          console.warn("[useChromeApi] Not a chrome API tool:", toolName);
          return;
        }

        console.log("[useChromeApi] Result for", toolName, ":", output);

        setMessages((prev) =>
          updateToolPartInMessages(prev, toolCallId, output),
        );

        if (output.success) {
          addToolOutput({
            tool: toolName,
            toolCallId,
            output: output,
            state: "output-available",
          });
        } else {
          addToolOutput({
            tool: toolName,
            toolCallId,
            state: "output-error",
            errorText: output.error || "Unknown error",
          });
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [messages, setMessages, addToolOutput]);
}

function findToolPartByCallId(messages: UIMessage[], toolCallId: string): any {
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if ((part as any).toolCallId === toolCallId) {
        return part;
      }
    }
  }
  return null;
}

function updateToolPartState(
  messages: UIMessage[],
  messageId: string,
  toolCallId: string,
  updates: { state: string; output: any },
): UIMessage[] {
  return messages.map((msg) => {
    if (msg.id !== messageId) return msg;
    return {
      ...msg,
      parts: msg.parts.map((p: any) => {
        if (p.toolCallId === toolCallId) {
          return { ...p, ...updates };
        }
        return p;
      }),
    };
  });
}

function updateToolPartInMessages(
  messages: UIMessage[],
  toolCallId: string,
  output: ChromeApiOutput,
): UIMessage[] {
  return messages.map((msg) => {
    if (msg.role !== "assistant") return msg;
    return {
      ...msg,
      parts: msg.parts.map((part: any) => {
        if (part.toolCallId === toolCallId) {
          return {
            ...part,
            output,
            state: output.success ? "output-available" : "output-error",
            errorText: output.error,
          };
        }
        return part;
      }),
    };
  });
}
