import { db } from '../db/client';
import * as schema from '../db/schema';
import type { z } from 'zod';
import type { AIProvider, AITaskType, GenerateOptions, GenerateResult, LLMConfig, LLMProvider } from './types';
import { AIProviderAdapter } from './provider';
import { resolveModel } from './registry';
import { getPrimaryAndFallback, resolveConfigFromEnv } from './config';

// ── Per-provider cost map (USD per 1M tokens) ──
const COST_MAP: Record<
  AIProvider,
  { input: number; output: number } | undefined
> = {
  openai: { input: 0.15, output: 0.60 },       // gpt-4o-mini default
  anthropic: { input: 0.80, output: 4.00 },    // claude-3-5-haiku default
  google: { input: 0.075, output: 0.30 },      // gemini-2.0-flash default
  kimi: { input: 0.50, output: 2.00 },         // moonshot-v1-128k approx
  groq: { input: 0.59, output: 0.79 },         // llama-3.3-70b
  ollama: { input: 0, output: 0 },             // local = free
};

function estimateCost(provider: AIProvider, promptTokens: number, completionTokens: number): number {
  const rates = COST_MAP[provider];
  if (!rates) return 0;
  return (promptTokens * rates.input + completionTokens * rates.output) / 1_000_000;
}

export class LLMService {
  private primary: LLMProvider;
  private fallback?: LLMProvider;
  private config: LLMConfig;

  constructor(primary: LLMProvider, config: LLMConfig, fallback?: LLMProvider) {
    this.primary = primary;
    this.config = config;
    this.fallback = fallback;
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult<string>> {
    return this._execute('generateText', options);
  }

  async generateObject<T>(
    options: GenerateOptions & { schema: z.ZodSchema<T> },
    meta?: { taskType: AITaskType; pdfId?: number }
  ): Promise<GenerateResult<T>> {
    return this._execute('generateObject', options, meta);
  }

  async *streamText(options: GenerateOptions): AsyncIterable<string> {
    yield* this.primary.streamText(options);
  }

  private async _execute<T>(
    method: 'generateText' | 'generateObject',
    options: GenerateOptions & { schema?: z.ZodSchema },
    meta?: { taskType: AITaskType; pdfId?: number }
  ): Promise<GenerateResult<T>> {
    const start = Date.now();
    let result: GenerateResult<T>;
    let usedFallback = false;

    try {
      if (method === 'generateObject' && options.schema) {
        result = await this.primary.generateObject(options as GenerateOptions & { schema: z.ZodSchema<T> });
      } else {
        result = (await this.primary.generateText(options)) as GenerateResult<T>;
      }
    } catch (err) {
      if (this.fallback) {
        usedFallback = true;
        if (method === 'generateObject' && options.schema) {
          result = await this.fallback.generateObject(options as GenerateOptions & { schema: z.ZodSchema<T> });
        } else {
          result = (await this.fallback.generateText(options)) as GenerateResult<T>;
        }
      } else {
        await this._logUsage({
          provider: this.primary.name,
          model: 'unknown',
          taskType: meta?.taskType ?? 'extraction',
          pdfId: meta?.pdfId,
          success: false,
          errorMessage: String(err),
          latencyMs: Date.now() - start,
        });
        throw err;
      }
    }

    // Fire-and-forget usage logging
    this._logUsage({
      provider: result.provider,
      model: result.model,
      taskType: meta?.taskType ?? 'extraction',
      pdfId: meta?.pdfId,
      success: true,
      latencyMs: result.latencyMs,
      promptTokens: result.usage?.promptTokens,
      completionTokens: result.usage?.completionTokens,
      totalTokens: result.usage?.totalTokens,
      costEstimate: result.usage
        ? estimateCost(result.provider, result.usage.promptTokens, result.usage.completionTokens)
        : undefined,
      usedFallback,
    }).catch(() => {});

    return result;
  }

  private async _logUsage(log: {
    provider: AIProvider;
    model: string;
    taskType: AITaskType;
    pdfId?: number;
    success: boolean;
    latencyMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costEstimate?: number;
    errorMessage?: string;
    usedFallback?: boolean;
  }): Promise<void> {
    try {
      db.insert(schema.aiUsageLogs).values({
        taskType: log.taskType,
        provider: log.provider,
        model: log.model,
        promptTokens: log.promptTokens ?? 0,
        completionTokens: log.completionTokens ?? 0,
        totalTokens: log.totalTokens ?? 0,
        costEstimate: log.costEstimate ?? 0,
        latencyMs: log.latencyMs,
        success: log.success,
        errorMessage: log.errorMessage,
        pdfId: log.pdfId,
      }).run();
    } catch {
      // Non-blocking: ignore logging failures
    }
  }
}

export async function createLLMService(): Promise<LLMService> {
  const { primary: primaryConfig, fallback: fallbackConfig } = getPrimaryAndFallback();

  let config: LLMConfig;
  let primaryProvider: LLMProvider;
  let fallbackProvider: LLMProvider | undefined;

  if (primaryConfig) {
    config = primaryConfig;
    primaryProvider = new AIProviderAdapter(
      primaryConfig.provider,
      resolveModel(primaryConfig)
    );
    if (fallbackConfig) {
      fallbackProvider = new AIProviderAdapter(
        fallbackConfig.provider,
        resolveModel(fallbackConfig)
      );
    }
  } else {
    const envConfig = resolveConfigFromEnv();
    if (!envConfig) {
      throw new Error('No AI provider configured. Add one in Settings > AI Providers or set AI_PROVIDER + API key env vars.');
    }
    config = envConfig;
    primaryProvider = new AIProviderAdapter(envConfig.provider, resolveModel(envConfig));
  }

  return new LLMService(primaryProvider, config, fallbackProvider);
}
