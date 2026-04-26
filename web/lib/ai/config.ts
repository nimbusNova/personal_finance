import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { AIProvider, LLMConfig } from './types';

const CONFIG_FILE = './data/ai-providers.json';

export interface AIProviderConfig extends LLMConfig {
  name: string;
  isActive: boolean;
  isFallback: boolean;
  priority: number;
}

export function readProviderConfigs(): AIProviderConfig[] {
  if (!existsSync(CONFIG_FILE)) return [];
  try {
    const data = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
    if (!Array.isArray(data)) return [];
    return data as AIProviderConfig[];
  } catch {
    return [];
  }
}

export function writeProviderConfigs(configs: AIProviderConfig[]): void {
  mkdirSync(dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
}

export function getActiveProviderConfigs(): AIProviderConfig[] {
  return readProviderConfigs()
    .filter((c) => c.isActive)
    .sort((a, b) => a.priority - b.priority);
}

export function resolveConfigFromEnv(): LLMConfig | null {
  const provider = (process.env.AI_PROVIDER || process.env.KIMI_API_KEY ? 'kimi' : '') as AIProvider;
  if (!provider) return null;

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.KIMI_API_KEY ||
    process.env.GROQ_API_KEY ||
    '';

  if (!apiKey) return null;

  return {
    provider,
    apiKey,
    baseURL: process.env.AI_BASE_URL || process.env.KIMI_BASE_URL || undefined,
    defaultModel: process.env.AI_MODEL || 'gpt-4o-mini',
    taskModels: {
      classification: process.env.AI_CLASSIFICATION_MODEL,
      extraction: process.env.AI_EXTRACTION_MODEL,
      repair: process.env.AI_REPAIR_MODEL,
    },
  };
}

export function getPrimaryAndFallback(): { primary?: AIProviderConfig; fallback?: AIProviderConfig } {
  const active = getActiveProviderConfigs();
  const primary = active.find((c) => !c.isFallback) || active[0];
  const fallback = active.find((c) => c.isFallback && c.name !== primary?.name);
  return { primary, fallback };
}
