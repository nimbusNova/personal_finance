import { generateText, generateObject, streamText, type LanguageModel } from 'ai';
import type { z } from 'zod';
import type { AIProvider, GenerateOptions, GenerateResult, LLMProvider } from './types';

export class AIProviderAdapter implements LLMProvider {
  readonly name: AIProvider;
  private model: LanguageModel;

  constructor(name: AIProvider, model: LanguageModel) {
    this.name = name;
    this.model = model;
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult<string>> {
    const start = Date.now();
    const result = await generateText({
      model: this.model,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens,
    } as any);

    return {
      content: result.text,
      usage: result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens: result.usage.totalTokens ?? 0,
          }
        : undefined,
      provider: this.name,
      model: result.response?.modelId ?? 'unknown',
      latencyMs: Date.now() - start,
    };
  }

  async generateObject<T>(
    options: GenerateOptions & { schema: z.ZodSchema<T> }
  ): Promise<GenerateResult<T>> {
    const start = Date.now();
    const result = await generateObject({
      model: this.model,
      system: options.system,
      prompt: options.prompt,
      schema: options.schema,
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens,
    } as any);

    return {
      content: result.object as T,
      usage: result.usage
        ? {
            promptTokens: result.usage.inputTokens ?? 0,
            completionTokens: result.usage.outputTokens ?? 0,
            totalTokens: result.usage.totalTokens ?? 0,
          }
        : undefined,
      provider: this.name,
      model: result.response?.modelId ?? 'unknown',
      latencyMs: Date.now() - start,
    };
  }

  async *streamText(options: GenerateOptions): AsyncIterable<string> {
    const result = await streamText({
      model: this.model,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens,
    } as any);

    for await (const chunk of result.textStream) {
      yield chunk;
    }
  }
}
