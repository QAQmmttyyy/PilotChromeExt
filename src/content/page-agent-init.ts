// Page Agent Initialization Script
// This script is dynamically injected by background script when needed
// It contains page-agent import which will inject CSS on load

import { PageAgent } from "page-agent";
import type { PageAgentWindowMessage } from "@pilot/shared";

console.log("[Pilot] Page Agent Init script loaded");

async function initPageAgent() {
  const config = (window as any).__pilotGetSavedConfig?.();

  if (!config || !config.apiKey) {
    console.error("[Pilot] Cannot create PageAgent: no valid config");
    window.postMessage(
      {
        source: "PILOT_MAIN",
        type: "PAGE_AGENT_CREATE_RESULT",
        success: false,
        error: "No valid config",
      },
      "*"
    );
    return;
  }

  const oldAgent = (window as any).pageAgent;
  if (oldAgent) {
    console.log("[Pilot] Disposing old PageAgent instance");
    try {
      if (typeof oldAgent.dispose === "function") {
        oldAgent.dispose();
      }
    } catch (e) {
      console.warn("[Pilot] Error disposing PageAgent:", e);
    }
  }

  const baseURL = config.endpoint
    ? config.endpoint.replace("/chat/completions", "")
    : "https://openrouter.ai/api/v1";

  if (typeof console.group !== "function") {
    console.group = (...args: any[]) => console.log("[GROUP]", ...args);
  }
  if (typeof console.groupEnd !== "function") {
    console.groupEnd = () => {};
  }

  try {
    // Create PageAgent with proper hooks
    (window as any).pageAgent = new PageAgent({
      apiKey: config.apiKey,
      model: config.model,
      baseURL: baseURL,

      // Disable ask_user tool - never ask user questions
      customTools: {
        ask_user: null,
      },
      include_attributes: ["class", "data-title"],

      onBeforeStep: async function (this: InstanceType<typeof PageAgent>) {
        // Intercept new page opens
        document.querySelectorAll('a[target="_blank"]').forEach((el) => {
          el.removeAttribute("target");
          console.log('[Pilot] Removed target="_blank" from:', el);
        });

        if (!(window as any).__pilotOpenIntercepted) {
          const originalOpen = window.open;
          (window as any).__pilotOriginalOpen = originalOpen;
          (window as any).__pilotOpenIntercepted = true;

          window.open = function (
            url?: string | URL,
            _target?: string,
            _features?: string
          ): Window | null {
            if (url) {
              const urlStr = url.toString();
              console.log(
                "[Pilot] Intercepted window.open, navigating in current page:",
                urlStr
              );
              location.href = urlStr;
            }
            return null;
          };

          console.log("[Pilot] window.open intercepted");
        }
      },

      onAfterStep: async function (this, stepCnt, history) {
        console.log(`[PageAgent] Step ${stepCnt} completed`);

        // Debug logging for element extraction
        try {
          const agent = this as any;

          // 尝试从 PageController 获取信息 (根据 d.ts 定义，主要逻辑在 PageController 中)
          const controller = agent.pageController;

          if (controller) {
            console.log("PageController found:", controller);

            // 尝试直接访问 private 属性 (运行时可能是可见的)
            const selectorMap =
              controller.selectorMap || controller._selectorMap;
            const simplifiedHTML =
              controller.simplifiedHTML || controller._simplifiedHTML;
            const elementTextMap =
              controller.elementTextMap || controller._elementTextMap;

            console.log("\n=== Step " + (stepCnt + 1) + " Element Info ===");
            console.log("SelectorMap size:", selectorMap?.size);
            // 如果属性访问不到，尝试调用公共方法
            if (!simplifiedHTML) {
              controller
                .getSimplifiedHTML()
                .then((html: string) =>
                  console.log("Simplified HTML (from method):", html)
                );
            } else {
              console.log("Simplified HTML:", simplifiedHTML);
            }

            console.log("Interactive elements:");
            if (selectorMap) {
              for (const [index, element] of selectorMap) {
                const text = elementTextMap?.get(index);
                console.log(
                  `  [${index}] ${element.tagName}: ${text}`,
                  element
                );
              }
            } else {
              console.warn(
                "Could not access selectorMap on PageController. Available keys:",
                Object.keys(controller)
              );
            }
          } else {
            // 回退：如果 pageController 不存在，打印 agent 自身结构以供调试
            console.warn(
              "PageController not found on agent. Agent keys:",
              Object.keys(agent)
            );
            console.log("Agent instance:", agent);
          }
        } catch (e) {
          console.error("[Pilot] Error logging element info:", e);
        }

        const lastStep = history[history.length - 1];
        if (lastStep) {
          const { action, usage } = lastStep;

          // Send detailed step log
          const message: PageAgentWindowMessage = {
            source: "PILOT_PAGEAGENT",
            type: "PAGEAGENT_STEP",
            payload: {
              timestamp: Date.now(),
              status: "success",
              stepNumber: stepCnt,
              action,
              usage,
            },
          };
          window.postMessage(message, "*");
        }
      },

      onAfterTask: async function (this, result) {
        console.log("[PageAgent] Task completed", result);

        // Send task completion log
        const message: PageAgentWindowMessage = {
          source: "PILOT_PAGEAGENT",
          type: "PAGEAGENT_STEP",
          payload: {
            timestamp: Date.now(),
            status: result.success ? "success" : "error",
            stepNumber: 0,
            action: {
              name: "done",
              input: null,
              output: result.data,
            },
          },
        };
        window.postMessage(message, "*");
      },
    });

    // Hide the panel UI - we use our own sidepanel UI
    const agent = (window as any).pageAgent;
    if (agent.panel) {
      agent.panel.hide();
      // Override show method to prevent it from showing up again during execute()
      agent.panel.show = () => {};
    }
    
    console.log("[Pilot] PageAgent created successfully");
    window.postMessage(
      {
        source: "PILOT_MAIN",
        type: "PAGE_AGENT_CREATE_RESULT",
        success: true,
      },
      "*"
    );
  } catch (e) {
    console.error("[Pilot] Failed to create PageAgent:", e);
    window.postMessage(
      {
        source: "PILOT_MAIN",
        type: "PAGE_AGENT_CREATE_RESULT",
        success: false,
        error: String(e),
      },
      "*"
    );
  }
}

initPageAgent();
