// AI Model Configuration

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  context: string;
  description: string;
  thinking?: boolean;
  recommended?: boolean;
}

// OpenRouter 最新可用模型（2026年1月）
export const AVAILABLE_MODELS: AIModel[] = [
  // ========== 推荐模型（快速高效） ==========
  { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini', provider: 'OpenAI', context: '1M', description: '快速便宜', recommended: true },
  { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Anthropic', context: '200K', description: '极速响应', thinking: true, recommended: true },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', provider: 'Google', context: '1M', description: '超快推理', thinking: true, recommended: true },
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', context: '164K', description: '性价比王', thinking: true, recommended: true },
  { id: 'x-ai/grok-4-fast', name: 'Grok 4 Fast', provider: 'xAI', context: '2M', description: '工具调用强', thinking: true, recommended: true },

  // ========== 其他模型 ==========
  // Qwen 系列
  { id: 'qwen/qwen3-235b-a22b', name: 'Qwen3 235B', provider: 'Qwen', context: '262K', description: '中文优化' },
  
  // OpenAI GPT 系列
  { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', context: '1M', description: '编码能力强' },
  { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano', provider: 'OpenAI', context: '1M', description: '极速便宜' },
  
  // xAI Grok 系列
  { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'xAI', context: '256K', description: '深度推理', thinking: true },
  { id: 'x-ai/grok-code-fast-1', name: 'Grok Code Fast', provider: 'xAI', context: '256K', description: '编程专精', thinking: true },
  
  // Anthropic Claude 系列
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', context: '200K', description: '经典稳定' },
  { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', context: '1M', description: '均衡之选', thinking: true },
  { id: 'anthropic/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Anthropic', context: '200K', description: '深度推理', thinking: true },
  
  // Google Gemini 系列
  { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', context: '1M', description: '多模态强', thinking: true },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'Google', context: '1M', description: '最强多模态', thinking: true },
];

export interface AIConfig {
  apiKey: string;
  model: string;
  endpoint: string;
}

export function getModelInfo(modelId: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === modelId);
}
