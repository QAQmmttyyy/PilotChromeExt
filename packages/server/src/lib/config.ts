import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export function getModel(): LanguageModel {
  const modelId = process.env.DEFAULT_MODEL || 'anthropic/claude-opus-4.5';
  return openrouter(modelId);
}
