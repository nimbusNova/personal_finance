import type { z } from 'zod';

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'kimi' | 'groq' | 'ollama';

export type AITaskType = 'classification' | 'extraction' | 'repair' | 'suggestion' | 'report' | 'chat';

export interface LLMConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  defaultModel: string;
  taskModels?: {
    classification?: string;
    extraction?: string;
    repair?: string;
  };
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  schema?: z.ZodSchema;
}

export interface GenerateResult<T = string> {
  content: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: AIProvider;
  model: string;
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: AIProvider;
  generateText(options: GenerateOptions): Promise<GenerateResult<string>>;
  generateObject<T>(options: GenerateOptions & { schema: z.ZodSchema<T> }): Promise<GenerateResult<T>>;
  streamText(options: GenerateOptions): AsyncIterable<string>;
}
