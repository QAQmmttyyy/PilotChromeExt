/**
 * Agent Service - 基于 Vercel AI SDK 的 Agent 核心
 * 
 * 流程：用户描述 → generate_steps → generate_script → run_workflow
 */

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { RecordedStep } from './types';
import { cleanGeneratedCode } from './ai';
import { parseScriptToWorkflow } from './parser';

// Agent 状态类型
export type AgentStatus = 'idle' | 'thinking' | 'generating_steps' | 'generating_script' | 'running' | 'completed' | 'error';

export interface AgentState {
  status: AgentStatus;
  steps: RecordedStep[];
  script: string;
  error?: string;
  toolCalls: ToolCallLog[];
}

export interface ToolCallLog {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  timestamp: number;
}

// Agent 配置
export interface AgentConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
}

// 创建 OpenRouter 兼容的 provider
function createProvider(config: AgentConfig) {
  return createOpenAI({
    apiKey: config.apiKey,
    baseURL: config.endpoint || 'https://openrouter.ai/api/v1',
  });
}

// Steps 生成的 system prompt
const STEPS_SYSTEM_PROMPT = `你是一个浏览器自动化任务分解专家。用户会描述一个网页操作任务，你需要将其分解为步骤序列。

## 步骤类型
只允许两种类型：
1. navigate - 导航到指定 URL
2. ai_step - AI 执行的操作指令（点击、输入、提取等）

## 输出格式
返回一个 JSON 数组，每个步骤包含：
- type: "navigate" 或 "ai_step"
- url: 导航目标 URL（navigate 类型必填）
- value: 操作指令描述（ai_step 类型必填）

## 重要规则
1. **按页面划分步骤**：同一页面内的多个操作应合并为一个 ai_step，不要拆太细
   - page-agent 可以在一次 execute 中完成多个同页面操作
   - 只有当操作会触发页面跳转时，才需要拆分为新步骤
2. **单页约束**：一个 ai_step 执行中不能触发页面导航
   - 如果某操作会导致页面跳转（如点击链接），应作为当前页面的最后一个操作
   - 跳转后的操作必须是新步骤
3. 如果用户未指定起始 URL，根据任务推断合理的起始页面
4. 操作指令要清晰、具体
5. 不要返回任何解释，只返回 JSON 数组`;

// 脚本生成的 system prompt（复用 ai.ts 的核心逻辑）
const SCRIPT_SYSTEM_PROMPT = `你是一个浏览器自动化脚本生成专家。根据提供的步骤序列生成可执行的 JavaScript 代码。

## 输入格式
你会收到一个步骤数组，每个步骤包含：
- type: "navigate" 或 "ai_step"
- url: 导航 URL（navigate 类型）
- value: AI 操作指令（ai_step 类型）

## 输出契约（必须满足）

1. **只输出纯 JavaScript 代码**：禁止 TypeScript。
2. **只输出代码**：禁止解释、禁止 markdown 代码块。输出必须以 \`// === STEP:\` 开头。
3. **多步骤格式**：
   - navigate 步骤：\`// === STEP: navigate (https://目标URL) ===\`
   - ai_step 步骤：\`// === STEP: AI Step ===\`（不要在括号中写 URL）

4. **AI Step 代码模板**：
\`\`\`
(async () => {
  try {
    if (!window.pageAgent?.execute) throw new Error("PageAgent 未就绪");
    await window.pageAgent.execute("操作指令");
    window.Pilot.workflow.next();
  } catch (err) {
    if (err.message?.includes('disposed')) return;
    window.Pilot.workflow.fail(err.message);
  }
})();
\`\`\`

5. **Navigate 步骤**：只需要 STEP 注释标明 URL，代码部分用简单的 next() 调用：
\`\`\`
(async () => {
  window.Pilot.workflow.next();
})();
\`\`\`

6. **最后一步**使用 \`finish()\` 而不是 \`next()\`

7. **跨步骤数据传递（非常重要）**：
   
   **返回值结构**：
   - \`pageAgent.execute()\` 返回 \`{ success: boolean, data: any, history: string[] }\`
   - **success=true**：操作成功，data 包含提取的数据或操作结果
   - **success=false**：操作失败，data 是错误信息字符串
   
   **必须严格检查 success（关键）**：
   \`\`\`
   const result = await window.pageAgent.execute("指令");
   if (!result.success) {
     return window.Pilot.workflow.fail(result.data || '操作失败');
   }
   // 只有 success=true 才能使用 result.data
   \`\`\`
   
   **数据提取示例**：
   \`\`\`
   // 提取单个值
   const result = await window.pageAgent.execute("获取页面标题");
   if (!result.success) return window.Pilot.workflow.fail(result.data);
   const title = result.data; // data 直接是提取的字符串
   window.Pilot.workflow.next({ pageTitle: title });
   
   // 提取多个值（AI 会返回对象）
   const result = await window.pageAgent.execute("提取商品名称和价格");
   if (!result.success) return window.Pilot.workflow.fail(result.data);
   // 如果 AI 返回的是 JSON 对象，data 可能是字符串，需要解析
   const info = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
   window.Pilot.workflow.next({ 
     productName: info.name,
     productPrice: info.price 
   });
   \`\`\`
   
   **使用上一步数据**：
   \`\`\`
   // 安全获取数据（带默认值）
   const title = window.PilotData?.pageTitle || '默认标题';
   const price = window.PilotData?.productPrice || '0';
   
   // 将数据传递给 AI 指令
   await window.pageAgent.execute(\`在搜索框中输入: "\${title}"\`);
   \`\`\`
   
   **数据为空时的处理**：
   \`\`\`
   const result = await window.pageAgent.execute("获取用户名");
   if (!result.success) return window.Pilot.workflow.fail(result.data);
   if (!result.data) {
     return window.Pilot.workflow.fail('未找到用户名');
   }
   window.Pilot.workflow.next({ username: result.data });
   \`\`\``;

// Step schema for validation
const StepSchema = z.object({
  type: z.enum(['navigate', 'ai_step']),
  url: z.string().optional(),
  value: z.string().optional(),
});

const StepsArraySchema = z.array(StepSchema);

// Agent 类
export class PilotAgent {
  private config: AgentConfig;
  private state: AgentState;
  private onStateChange?: (state: AgentState) => void;

  constructor(config: AgentConfig, onStateChange?: (state: AgentState) => void) {
    this.config = config;
    this.onStateChange = onStateChange;
    this.state = {
      status: 'idle',
      steps: [],
      script: '',
      toolCalls: [],
    };
  }

  private updateState(partial: Partial<AgentState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.state);
  }

  private logToolCall(name: string, args: Record<string, unknown>, result?: unknown) {
    const log: ToolCallLog = { name, args, result, timestamp: Date.now() };
    this.updateState({ toolCalls: [...this.state.toolCalls, log] });
  }

  getState(): AgentState {
    return this.state;
  }

  async run(userPrompt: string): Promise<AgentState> {
    this.updateState({ 
      status: 'thinking', 
      steps: [], 
      script: '', 
      error: undefined,
      toolCalls: [] 
    });

    const provider = createProvider(this.config);

    try {
      // Step 1: 生成步骤
      this.updateState({ status: 'generating_steps' });
      const steps = await this.generateSteps(provider, userPrompt);
      this.updateState({ steps });

      // Step 2: 生成脚本
      this.updateState({ status: 'generating_script' });
      const script = await this.generateScript(provider, steps);
      this.updateState({ script });

      // Step 3: 准备执行（实际执行由 UI 触发）
      this.updateState({ status: 'completed' });

      return this.state;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.updateState({ status: 'error', error: errorMsg });
      throw error;
    }
  }

  private async generateSteps(provider: ReturnType<typeof createOpenAI>, userPrompt: string): Promise<RecordedStep[]> {
    const { text } = await generateText({
      model: provider(this.config.model),
      system: STEPS_SYSTEM_PROMPT,
      prompt: userPrompt,
    });

    this.logToolCall('generate_steps', { userPrompt }, text);

    // 解析 JSON
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI 未返回有效的步骤 JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = StepsArraySchema.parse(parsed);

    // 转换为 RecordedStep 格式
    return validated.map((step, index) => ({
      id: `step-${index + 1}`,
      timestamp: Date.now(),
      type: step.type as 'navigate' | 'ai_step',
      url: step.url || '',
      pageTitle: step.type === 'navigate' ? `导航到 ${step.url}` : (step.value || ''),
      value: step.value,
    }));
  }

  private async generateScript(provider: ReturnType<typeof createOpenAI>, steps: RecordedStep[]): Promise<string> {
    const stepsJson = JSON.stringify(steps.map(s => ({
      type: s.type,
      url: s.url || undefined,
      value: s.value || undefined,
    })), null, 2);

    const { text } = await generateText({
      model: provider(this.config.model),
      system: SCRIPT_SYSTEM_PROMPT,
      prompt: `请根据以下步骤生成脚本：\n\n${stepsJson}`,
    });

    this.logToolCall('generate_script', { steps: stepsJson }, text);

    return cleanGeneratedCode(text);
  }

  async executeScript(tabId: number): Promise<void> {
    if (!this.state.script) {
      throw new Error('没有可执行的脚本');
    }

    this.updateState({ status: 'running' });

    const workflowSteps = parseScriptToWorkflow(this.state.script);
    
    // 发送到 background 执行
    await chrome.runtime.sendMessage({
      type: 'START_WORKFLOW',
      payload: { steps: workflowSteps, tabId }
    });

    this.logToolCall('run_workflow', { tabId, stepsCount: workflowSteps.length });
  }
}

// 工厂函数
export function createAgent(config: AgentConfig, onStateChange?: (state: AgentState) => void): PilotAgent {
  return new PilotAgent(config, onStateChange);
}

// ============== Agent Task Storage ==============

export interface AgentTask {
  id: string;
  prompt: string;
  steps: RecordedStep[];
  script: string;
  status: 'completed' | 'failed';
  createdAt: number;
  executedAt?: number;
}

const AGENT_TASKS_KEY = 'agentTasks';
const MAX_TASKS = 50;

export const agentTaskStorage = {
  async getTasks(): Promise<AgentTask[]> {
    const result = await chrome.storage.local.get(AGENT_TASKS_KEY);
    return (result[AGENT_TASKS_KEY] as AgentTask[]) || [];
  },

  async saveTask(task: AgentTask): Promise<void> {
    const tasks = await this.getTasks();
    const existingIdx = tasks.findIndex(t => t.id === task.id);
    
    if (existingIdx >= 0) {
      tasks[existingIdx] = task;
    } else {
      tasks.unshift(task);
    }

    // 限制历史数量
    const trimmed = tasks.slice(0, MAX_TASKS);
    await chrome.storage.local.set({ [AGENT_TASKS_KEY]: trimmed });
  },

  async deleteTask(id: string): Promise<void> {
    const tasks = await this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    await chrome.storage.local.set({ [AGENT_TASKS_KEY]: filtered });
  },

  async updateExecutedAt(id: string): Promise<void> {
    const tasks = await this.getTasks();
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.executedAt = Date.now();
      await chrome.storage.local.set({ [AGENT_TASKS_KEY]: tasks });
    }
  },

  async clearAll(): Promise<void> {
    await chrome.storage.local.remove(AGENT_TASKS_KEY);
  }
};

