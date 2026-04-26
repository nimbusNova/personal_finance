import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type { AIProvider, LLMConfig } from './types';

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-2.0-flash',
  kimi: 'moonshot-v1-128k',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
};

const DEFAULT_BASE_URLS: Record<AIProvider, string | undefined> = {
  openai: undefined,
  anthropic: undefined,
  google: undefined,
  kimi: 'https://api.moonshot.cn/v1',
  groq: 'https://api.groq.com/openai/v1',
  ollama: 'http://localhost:11434/v1',
};

export function resolveModel(config: LLMConfig, task?: 'classification' | 'extraction' | 'repair'): LanguageModel {
  const modelName = task && config.taskModels?.[task]
    ? config.taskModels[task]
    : config.defaultModel || DEFAULT_MODELS[config.provider];

  switch (config.provider) {
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey })(modelName);

    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey })(modelName);

    case 'google':
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(modelName);

    case 'kimi':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || DEFAULT_BASE_URLS.kimi,
      })(modelName);

    case 'groq':
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || DEFAULT_BASE_URLS.groq,
      })(modelName);

    case 'ollama':
      return createOpenAI({
        baseURL: config.baseURL || DEFAULT_BASE_URLS.ollama,
      })(modelName);

    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export function getDefaultBaseURL(provider: AIProvider): string | undefined {
  return DEFAULT_BASE_URLS[provider];
}
