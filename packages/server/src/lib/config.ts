import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  extraBody: {
    plugins: [
      { "id": "web", "enabled": false }
    ],
    transforms: ["middle-out"],
  },
});

export function getModel(): LanguageModel {
  // return openrouter('google/gemini-3-flash-preview');
  // return openrouter('deepseek/deepseek-v3.2');
  // return openrouter('x-ai/grok-code-fast-1');
  return openrouter('minimax/minimax-m2.1');
}
