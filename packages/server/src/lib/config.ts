import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  headers: {
    'HTTP-Referer': 'https://github.com/workmoly/pilot-chrome-ext', // OpenRouter 建议添加
    'X-Title': 'Pilot Agent', // OpenRouter 建议添加
  },
  extraBody: {
    plugins: [
      { "id": "web", "enabled": false }
    ],
    transforms: ["middle-out"],
  },
});

export function getModel(): LanguageModel {
  // return openrouter('google/gemini-3-flash-preview');
  return openrouter('deepseek/deepseek-v3.2');
}
