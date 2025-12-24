// AI Service - OpenRouter 接入（支持流式输出 + 多轮对话）

import { RecordingSession, RecordedStep } from './types';

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

// 系统提示词（强约束：让模型更“守规矩”，并显式利用 pageContext）
const SYSTEM_PROMPT = `

## 输入约定（非常重要）

用户消息可能包含：
- <<PAGE_CONTEXT>>
- <<END_PAGE_CONTEXT>>

PAGE_CONTEXT 是当前页面可操作元素的提取结果（包含 [uid]、属性、文本）。当它存在时：
- **优先从 PAGE_CONTEXT 里挑选元素与选择器**，不要凭空"猜"选择器。
- 如果 PAGE_CONTEXT 里没有目标元素，再退而求其次用稳定属性（id/name/aria-label/role/语义标签）构造选择器，并提供备选。

用户消息也可能包含：
- <<RECORDING_CONTEXT>>
- <<END_RECORDING_CONTEXT>>

RECORDING_CONTEXT 是用户录制的操作流程，包含每一步的操作类型、元素信息、选择器候选等。当它存在时：
- **严格按照录制的步骤顺序生成脚本**，确保每一步都对应录制中的操作。
- **优先使用录制中提供的选择器候选**，它们是从实际 DOM 中提取的，更可靠。
- 如果录制包含多页面导航，使用 \`// === STEP:\` 格式分隔不同页面的步骤。
- 录制中的元素信息可能不完整，但选择器候选通常是准确的。
## 输出契约（必须满足）

1. **只输出纯 JavaScript 代码**：禁止 TypeScript（as、类型注解、interface、泛型等）。
2. **只输出代码**：禁止解释、禁止 markdown 代码块、禁止前后缀文字。输出必须以 \`// === STEP:\` 或 \`(async () =>\` 开头。
3. **选择器必须可被 querySelector 执行**：
   - 禁止非标准伪类：\`:has-text()\`、\`:contains()\`、\`:text()\`、\`:has()\` 等一律禁止。
   - 允许的策略：\`#id\`、\`[name="..."]\`、\`[aria-label="..."]\`、\`[role="..."]\`、语义标签 + 属性。
   - 当存在多个备选时，用逗号合并（\`'a, b, c'\`），并优先靠稳定属性排序。
4. **等待机制**：禁止用 setTimeout“猜时间”等待页面/元素出现。
   - 需要等待时，必须在脚本顶部定义 \`waitFor(selector, timeout)\`（轮询或 MutationObserver 均可），并在实际等待处使用它。
   - 不需要等待就不要定义 waitFor。
5. **错误必须终止流程**：任意一步失败都调用 \`window.Pilot.workflow.fail(reason)\` 并 return。
6. **流程收尾必须明确**：
    - 单步：\`finish()\`
    - 多步：中间用 \`next(data)\`，最后一步用 \`finish()\`
7. **AI Step 集成**：如果录制中包含 \`ai_step\`（AI 指令），必须生成如下格式的代码：
   \`try {\`
   \`  if (!window.pageAgent) throw new Error("PageAgent 未初始化");\`
   \`  await window.pageAgent.execute("用户指令");\`
   \`  window.Pilot.workflow.next();\`
   \`} catch (err) {\`
   \`  // 忽略由于页面跳转导致的动作中断错误\`
   \`  if (err.message?.includes('disposed')) return;\`
   \`  window.Pilot.workflow.fail(err.message);\`
   \`}\`
   - **必须使用 await**。
   - 不要生成额外的 waitFor 或 selector，因为 pageAgent 会处理。
   - 必须包裹在上述 try-catch 中。
8. **多步骤格式**：用顶层注释分隔：
   \`// === STEP: 名称 (https://目标URL可选) ===\`
   注释必须在顶层，不能写在函数内部。

## 生成前自检（必须逐条满足，勿输出自检内容）

- 输出是否只有代码、且首行符合规则？
- 是否包含 TS 语法或非标准选择器？（必须为否）
- 是否有 setTimeout 作为等待？（必须为否；仅允许作为 waitFor 的超时机制）
- 是否所有分支最终会 finish/next/fail 之一？
- 是否在 PAGE_CONTEXT 存在时优先使用其中的元素/属性？

## 输出

只输出可执行 JavaScript。`;

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
      // temperature: 0.7,
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
    // 检测是否是录制上下文
    if (pageContext.startsWith('<<RECORDING_CONTEXT>>')) {
      return `${pageContext}\n\n用户需求:\n${prompt}`;
    }
    return `当前页面信息:\n${pageContext}\n\n用户需求:\n${prompt}`;
  }
  return prompt;
}

// 将录制步骤转换为描述
function formatRecordedStep(step: RecordedStep, index: number): string {
  const lines: string[] = [];
  lines.push(`Step ${index + 1}: ${getStepTypeName(step.type)}`);
  lines.push(`- URL: ${step.url}`);
  lines.push(`- 页面: ${step.pageTitle}`);
  
  if (step.element) {
    const el = step.element;
    const attrsStr = Object.entries(el.attributes)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    lines.push(`- 元素: <${el.tag}${attrsStr ? ' ' + attrsStr : ''}>${el.text}</${el.tag}>`);
    lines.push(`- 选择器候选: ${el.selectors.slice(0, 5).join(', ')}`);
  }
  
  if (step.value !== undefined) {
    if (step.type === 'ai_step') {
      lines.push(`- AI 指令: "${step.value}"`);
    } else {
      lines.push(`- 输入值: "${step.value}"`);
    }
  }
  
  if (step.key) {
    lines.push(`- 按键: ${step.key}`);
  }
  
  return lines.join('\n');
}

function getStepTypeName(type: RecordedStep['type']): string {
  const names: Record<RecordedStep['type'], string> = {
    click: '点击',
    input: '输入',
    navigate: '页面导航',
    submit: '提交表单',
    select: '选择下拉框',
    keypress: '按键',
    ai_step: 'AI 指令',
  };
  return names[type] || type;
}

// 构建录制上下文
export function buildRecordingContext(session: RecordingSession): string {
  const lines: string[] = [];
  lines.push('<<RECORDING_CONTEXT>>');
  lines.push(`录制名称: ${session.name}`);
  lines.push(`起始 URL: ${session.startUrl}`);
  lines.push(`步骤数量: ${session.steps.length}`);
  lines.push('');
  lines.push('## 录制的操作流程');
  lines.push('');
  
  // 按 URL 分组步骤
  let currentUrl = '';
  session.steps.forEach((step, idx) => {
    if (step.url !== currentUrl) {
      if (currentUrl) lines.push('');
      lines.push(`### 页面: ${step.url}`);
      currentUrl = step.url;
    }
    lines.push('');
    lines.push(formatRecordedStep(step, idx));
  });
  
  lines.push('');
  lines.push('<<END_RECORDING_CONTEXT>>');
  
  return lines.join('\n');
}

// 清理生成的代码（移除可能的 markdown 包裹）
export function cleanGeneratedCode(code: string): string {
  let cleaned = code;

  // 去掉 markdown 包裹
  cleaned = cleaned.replace(/^```(?:javascript|js)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  // 如果模型仍输出了解释，尽量从第一个“看起来像代码”的位置开始截断
  const anchors = [
    '// === STEP:',
    '(async () =>',
    ';(async () =>',
    '(() =>',
    ';(() =>',
    'const ',
    'let ',
    'var ',
    'function ',
  ];
  let idx = -1;
  for (const a of anchors) {
    const i = cleaned.indexOf(a);
    if (i >= 0 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx > 0) cleaned = cleaned.slice(idx);

  return cleaned.trim();
}

// 获取模型信息
export function getModelInfo(modelId: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}
