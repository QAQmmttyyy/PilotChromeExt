// AI Service - OpenRouter 接入（支持流式输出 + 多轮对话）

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  context: string;
  description: string;
  thinking?: boolean; // 是否支持思考模式
}

// OpenRouter 最新可用模型（2025年12月）
export const AVAILABLE_MODELS: AIModel[] = [
  // Anthropic Claude 系列（最新）
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic', context: '200K', description: '最强旗舰', thinking: true },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', context: '1M', description: '最新推荐', thinking: true },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Anthropic', context: '200K', description: '快速高效', thinking: true },
  { id: 'anthropic/claude-opus-4.1', name: 'Claude Opus 4.1', provider: 'Anthropic', context: '200K', description: '编码推理强', thinking: true },
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic', context: '1M', description: '性价比高', thinking: true },
  { id: 'anthropic/claude-3.7-sonnet:thinking', name: 'Claude 3.7 Sonnet', provider: 'Anthropic', context: '200K', description: '思考模式', thinking: true },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K', description: '经典稳定' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic', context: '200K', description: '极速便宜' },
  
  // OpenAI GPT 系列（最新）
  { id: 'openai/gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', context: '400K', description: '最新旗舰', thinking: true },
  { id: 'openai/gpt-5.2-pro', name: 'GPT-5.2 Pro', provider: 'OpenAI', context: '400K', description: '深度推理', thinking: true },
  { id: 'openai/gpt-5.2-chat', name: 'GPT-5.2 Chat', provider: 'OpenAI', context: '128K', description: '快速对话' },
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', context: '128K', description: '多模态' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', context: '128K', description: '便宜实惠' },
  { id: 'openai/o3-mini', name: 'O3 Mini', provider: 'OpenAI', context: '200K', description: '推理模型', thinking: true },
  
  // Google Gemini 系列
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', provider: 'Google', context: '1M', description: '最强多模态', thinking: true },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google', context: '1M', description: '快速免费' },
  
  // DeepSeek 系列
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', context: '64K', description: '推理能力强', thinking: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'DeepSeek', context: '64K', description: '极致性价比' },
  
  // Mistral 系列
  { id: 'mistralai/devstral-2512', name: 'Devstral 2', provider: 'Mistral', context: '256K', description: '编程专精' },
];

export interface AIConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

// 系统提示词
const SYSTEM_PROMPT = `你是 Pilot 浏览器自动化脚本生成器。根据用户需求生成精简、可直接运行的 JavaScript 脚本。

## 规则

1. 纯 JavaScript，禁止 TypeScript 语法
2. 工具函数（如等待元素、延迟）只在需要时定义，定义在脚本开头
3. 多步骤用 \`// === STEP: 步骤名 (https://目标URL) ===\` 分隔
4. 流程控制：
   - window.Pilot.workflow.next(data) - 步骤完成，传数据
   - window.Pilot.workflow.fail(reason) - 出错停止
   - window.Pilot.workflow.finish() - 流程结束
5. 异步操作用 try/catch 包裹，失败调用 fail()

## 输出

直接输出可执行代码，不要解释，不要 markdown 代码块。`;

// 流式生成（支持多轮对话）
export async function* generateScriptStream(
  messages: ChatMessage[],
  config: AIConfig
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(config.endpoint || DEFAULT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'HTTP-Referer': 'chrome-extension://pilot',
      'X-Title': 'Pilot Chrome Extension'
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ],
      temperature: 0.7,
      stream: true
      // 不设置 max_tokens，让模型自己决定
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
    throw new Error(error.error?.message || `请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应流');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}

// 构建用户消息（包含页面上下文）
export function buildUserMessage(prompt: string, pageContext?: string): string {
  if (pageContext) {
    return `当前页面信息:\n${pageContext}\n\n用户需求:\n${prompt}`;
  }
  return prompt;
}

// 清理生成的代码（移除可能的 markdown 包裹）
export function cleanGeneratedCode(code: string): string {
  let cleaned = code.replace(/^```(?:javascript|js)?\n?/, '');
  cleaned = cleaned.replace(/\n?```$/, '');
  return cleaned.trim();
}

// 获取模型信息
export function getModelInfo(modelId: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}
