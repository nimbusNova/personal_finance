# PRD: LLM Provider Abstraction — Multi-Provider AI Support

**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Draft  
**Author:** Michael Wu  
**Depends On:** PRD-NextJS-Only-Architecture.md

---

## 1. Executive Summary

### Current State
- **Hardcoded Provider:** Kimi (Moonshot AI) via raw `httpx` client in Python
- **Integration Points:** PDF text extraction (3-stage pipeline), document classification, structured data extraction, JSON repair
- **Configuration:** `.env` holds `kimi_api_key`, `kimi_base_url`, `kimi_model` — all Kimi-specific
- **Architecture Tight-Coupling:** `KimiService` class name, Moonshot file API (`/files`, `/files/{id}/content`), Kimi-specific model names leaked throughout

### Proposed State
- **Provider-Agnostic Core:** A single `LLMService` interface that works with any supported provider
- **Supported Providers (Phase 1):** OpenAI, Anthropic Claude, Google Gemini, Moonshot (Kimi)
- **Supported Providers (Phase 2):** Azure OpenAI, AWS Bedrock, Groq, Ollama (local), DeepSeek
- **Configuration:** One `AI_PROVIDER` env var + provider-specific keys; model selection per task type
- **Library Choice:** Vercel AI SDK (`ai` + `@ai-sdk/*` providers) — see §4 for full analysis

### Why This Change?
1. **Vendor Independence** — Avoid lock-in to Kimi pricing, availability, or policy changes
2. **Model Selection** — Use cheaper models for simple tasks, stronger models for complex extraction
3. **Resilience** — Automatic fallback to backup provider on outages or rate limits
4. **User Choice** — Users bring their own API keys (OpenAI, Claude, etc.)
5. **Future-Proofing** — New providers/models added with ~5 lines of config, zero code changes

---

## 2. Current Architecture Analysis

### 2.1 Kimi Integration Points

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Current Stack                                   │
│                                                                              │
│   PDF Upload ──► ExtractionService ──► KimiService.extract_from_pdf()       │
│                                              │                              │
│                              ┌───────────────┼───────────────┐              │
│                              ▼               ▼               ▼              │
│                         classify()    extract()        repair_json()       │
│                              │               │               │              │
│                              └───────────────┴───────────────┘              │
│                                              │                              │
│                                         httpx.Client                        │
│                                              │                              │
│                                         api.moonshot.cn                     │
│                                                                              │
│   File Management ──► routers/kimi_files.py ──► service.client.get()       │
│                                    (leaks HTTP client)                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Current Pain Points

| Pain Point | Impact | Example |
|------------|--------|---------|
| Hardcoded model | Cannot upgrade or switch models | `"moonshot-v1-128k"` baked into config |
| Kimi file API dependency | Cannot switch to non-file providers | Uploads to `/files`, reads `/files/{id}/content` |
| No retry/fallback | Single point of failure | Kimi outage = all extractions fail |
| No cost optimization | Overpaying for simple tasks | Same expensive model for classification + extraction |
| No structured output guarantee | JSON parsing failures | Manual `"max_tokens"`, manual JSON repair stage |
| Python-only | Blocks Next.js migration | Must rewrite anyway — do it right |

---

## 3. Proposed Architecture

### 3.1 Design Principles

1. **Interface over Implementation** — Core logic talks to `LLMService`, never to a provider directly
2. **Task-Based Model Selection** — Different models per task (classification = cheap/fast, extraction = smart/accurate)
3. **Provider as Config** — Switching providers changes one env var, not code
4. **Graceful Degradation** — Fallback chain: primary → secondary → local (Ollama)
5. **Streaming Optional** — All calls support streaming; extraction uses non-streaming for reliability

### 3.2 Target Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         Proposed Stack (Next.js Only)                        │
│                                                                              │
│   PDF Upload ──► ExtractionService ──► LLMService.generate()                │
│                                              │                              │
│                    ┌─────────────────────────┼─────────────────────────┐    │
│                    ▼                         ▼                         ▼    │
│            ┌─────────────┐          ┌─────────────┐          ┌───────────┐ │
│            │  classify   │          │  extract    │          │  repair   │ │
│            │  (cheap)    │          │  (smart)    │          │  (fast)   │ │
│            └──────┬──────┘          └──────┬──────┘          └─────┬─────┘ │
│                   │                        │                       │      │
│                   └────────────────────────┼───────────────────────┘      │
│                                            │                              │
│                                    ProviderRegistry                        │
│                                            │                              │
│         ┌──────────┬──────────┬────────────┼──────────┬──────────┐        │
│         ▼          ▼          ▼            ▼          ▼          ▼        │
│    ┌────────┐ ┌────────┐ ┌────────┐  ┌────────┐ ┌────────┐ ┌────────┐   │
│    │ OpenAI │ │Claude  │ │ Gemini │  │  Kimi  │ │  Groq  │ │ Ollama │   │
│    └────────┘ └────────┘ └────────┘  └────────┘ └────────┘ └────────┘   │
│                                                                              │
│   File Management ──► Removed (use local PDF parsing via pdfjs-dist)       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Key Abstractions

```typescript
// lib/ai/types.ts

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'kimi' | 'groq' | 'ollama';

export interface LLMConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;          // Optional override (e.g., Ollama local endpoint)
  defaultModel: string;
  taskModels?: {
    classification?: string;  // Cheap/fast model for doc type detection
    extraction?: string;      // Smart model for structured data extraction
    repair?: string;          // Fallback model for JSON repair
  };
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  // Structured output via Zod schema
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
```

---

## 4. Library Research & Recommendation

### 4.1 Candidate Libraries Evaluated

| Library | Provider Support | TS/JS Quality | Bundle Size | Edge Runtime | Structured Output | Best For |
|---------|-----------------|---------------|-------------|--------------|-------------------|----------|
| **Vercel AI SDK** | 25+ (OpenAI, Anthropic, Google, Mistral, Groq, etc.) | ⭐⭐⭐ Excellent | 67KB gzipped | ✅ Native | ✅ `generateObject()` with Zod | **Next.js apps, minimal abstraction** |
| **LangChain JS** | 50+ | ⭐⭐ Good | 101KB gzipped | ❌ No (Node fs dep) | ✅ With output parsers | Complex agents, RAG pipelines |
| **OpenAI SDK** | OpenAI only (+ compatible endpoints) | ⭐⭐⭐ Excellent | 34KB gzipped | ⚠️ Edge variant | ⚠️ Manual parsing | OpenAI-only apps |
| **Mastra** | Multi-provider | ⭐⭐ Good | ~80KB | ✅ Yes | ✅ Built-in | Agent workflows, orchestration |
| **LiteLLM (Proxy)** | 100+ | N/A (proxy) | N/A | ✅ Yes | ✅ Unified format | Enterprise gateway, centralized mgmt |
| **Portkey** | 100+ | ⭐⭐ Good | ~40KB | ✅ Yes | ✅ Yes | Observability + routing |
| **Helicone** | 100+ | ⭐⭐ Good | Lightweight | ✅ Yes | ✅ Yes | Logging, cost tracking |

### 4.2 Detailed Analysis

#### ✅ Recommended: Vercel AI SDK

```typescript
// What the code looks like
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

// Switch provider by changing ONE line
const model = openai('gpt-4o-mini');      // OpenAI
const model = anthropic('claude-3-5-sonnet-20241022'); // Anthropic
const model = google('gemini-2.0-flash');  // Google

// Structured output with automatic JSON parsing + validation
const result = await generateObject({
  model,
  schema: z.object({
    docType: z.enum(['brokerage', 'bank', 'credit_card', 'unknown']),
    confidence: z.number().min(0).max(1),
  }),
  system: CLASSIFICATION_SYSTEM_PROMPT,
  prompt: pdfText,
});

// result.object is fully typed: { docType: 'brokerage', confidence: 0.95 }
```

**Why Vercel AI SDK Wins for This Project:**

1. **Next.js Native** — Built by Vercel, designed for App Router API routes. Zero friction.
2. **Provider Switching is Trivial** — Change `openai('gpt-4o')` to `anthropic('claude-sonnet')`. Same API, same types, same error handling.
3. **`generateObject()` Eliminates JSON Repair Stage** — Zod schema guarantees valid JSON. No more Stage 3 "repair JSON" fallback. The SDK handles retries internally.
4. **No Python-to-JS Rewrite Waste** — We're already migrating to Next.js. Using AI SDK means the LLM code is idiomatic TypeScript from day one.
5. **Streaming When We Need It** — `streamText()` for future chat/suggestion features. `generateText()` for extraction reliability.
6. **No LangChain Bloat** — We don't need chains, agents, retrievers, or memory. AI SDK gives us exactly what we need: `generateText`, `generateObject`, `streamText`.
7. **Edge Compatible** — Runs in Vercel Edge Functions if we ever want global deployment.

#### ❌ Not Recommended: LangChain

- **Edge Runtime Blocked** — Uses Node.js `fs` module. Cannot run in Edge Functions.
- **Overkill for Our Use Case** — We need "send prompt, get structured JSON." LangChain's chains, prompt templates, and output parsers add 3x abstraction overhead.
- **Bundle Size** — 101KB gzipped vs 67KB for AI SDK. Not huge, but unnecessary.
- **Python Heritage** — JS port feels second-class. Documentation, examples, and community are Python-first.

> "Honestly, just go with Vercel AI SDK for JavaScript projects. It's way cleaner than LangChain's mess and has solid TypeScript support." — Community consensus, 2025-2026

#### ⚠️ Alternative: LiteLLM Proxy (for advanced users)

If we later need enterprise features (cost tracking across providers, load balancing, rate limit management), LiteLLM Proxy is a drop-in addition:

```
App ──► LiteLLM Proxy ──► OpenAI / Claude / Gemini / Kimi
        (unified billing, routing, fallbacks)
```

This is **Phase 2** — not needed for initial abstraction. The AI SDK's built-in provider switching is sufficient.

### 4.3 Final Recommendation

**Use Vercel AI SDK as the primary abstraction layer.**

```
Dependencies to add:
  ai                    (core SDK)
  @ai-sdk/openai        (OpenAI provider)
  @ai-sdk/anthropic     (Claude provider)
  @ai-sdk/google        (Gemini provider)
  zod                   (schema validation, already in most projects)

Optional Phase 2:
  @ai-sdk/groq          (fast/cheap inference)
  ollama-ai-provider    (local models)
```

---

## 5. Implementation Plan

### 5.1 File Structure

```
web/
├── lib/
│   ├── ai/
│   │   ├── types.ts           # LLMProvider interface, GenerateOptions, GenerateResult
│   │   ├── registry.ts        # ProviderRegistry: factory + config resolution
│   │   ├── provider.ts        # Base provider adapter wrapping Vercel AI SDK
│   │   ├── providers/
│   │   │   ├── openai.ts      # OpenAI provider factory
│   │   │   ├── anthropic.ts   # Claude provider factory
│   │   │   ├── google.ts      # Gemini provider factory
│   │   │   └── kimi.ts        # Moonshot (Kimi) provider factory (OpenAI-compatible)
│   │   ├── prompts/
│   │   │   ├── classification.ts   # Doc type classification prompt
│   │   │   ├── extraction.ts       # Structured extraction prompts (brokerage/bank/cc)
│   │   │   └── repair.ts           # JSON repair prompt (deprecated by generateObject)
│   │   ├── service.ts         # LLMService: high-level business logic
│   │   └── index.ts           # Public exports
│   └── ...
├── app/
│   └── api/
│       └── ai/
│           ├── classify/route.ts      # POST /api/ai/classify
│           ├── extract/route.ts       # POST /api/ai/extract
│           ├── generate/route.ts      # POST /api/ai/generate (generic)
│           └── stream/route.ts        # POST /api/ai/stream (for future chat UI)
```

### 5.2 Core Implementation

#### Provider Registry

```typescript
// lib/ai/registry.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai'; // For OpenAI-compatible APIs (Kimi, Groq, DeepSeek)
import { type LanguageModel } from 'ai';
import { type AIProvider } from './types';

const registry: Record<AIProvider, (apiKey: string, baseURL?: string) => LanguageModel> = {
  openai: (key) => openai('gpt-4o-mini', { apiKey: key }),
  anthropic: (key) => anthropic('claude-3-5-sonnet-20241022', { apiKey: key }),
  google: (key) => google('gemini-2.0-flash', { apiKey: key }),
  kimi: (key) => createOpenAI({ apiKey: key, baseURL: 'https://api.moonshot.cn/v1' })('moonshot-v1-128k'),
  groq: (key) => createOpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' })('llama-3.3-70b-versatile'),
  ollama: (_, baseURL) => createOpenAI({ baseURL: baseURL ?? 'http://localhost:11434/api' })('llama3.2'),
};

export function resolveModel(config: {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}): LanguageModel {
  const factory = registry[config.provider];
  if (!factory) throw new Error(`Unknown provider: ${config.provider}`);
  
  // If a specific model is requested, use createOpenAI/createProvider pattern
  // with the model name override
  return factory(config.apiKey, config.baseURL);
}
```

#### LLM Service (Business Logic)

```typescript
// lib/ai/service.ts
import { generateText, generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import { resolveModel } from './registry';
import { type GenerateOptions, type GenerateResult, type AIProvider } from './types';

export class LLMService {
  private model: LanguageModel;
  private provider: AIProvider;

  constructor(config: { provider: AIProvider; apiKey: string; model?: string; baseURL?: string }) {
    this.model = resolveModel(config);
    this.provider = config.provider;
  }

  async generateText(options: GenerateOptions): Promise<GenerateResult<string>> {
    const start = Date.now();
    const result = await generateText({
      model: this.model,
      system: options.system,
      prompt: options.prompt,
      temperature: options.temperature ?? 0.1, // Low temp for deterministic extraction
      maxTokens: options.maxTokens,
    });

    return {
      content: result.text,
      usage: result.usage,
      provider: this.provider,
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
      maxTokens: options.maxTokens,
    });

    return {
      content: result.object,
      usage: result.usage,
      provider: this.provider,
      model: result.response?.modelId ?? 'unknown',
      latencyMs: Date.now() - start,
    };
  }
}

// Factory from env
export function createLLMService(): LLMService {
  const provider = (process.env.AI_PROVIDER ?? 'openai') as AIProvider;
  const apiKey = process.env.AI_API_KEY ?? '';
  const model = process.env.AI_MODEL;
  const baseURL = process.env.AI_BASE_URL;

  if (!apiKey) {
    throw new Error(`AI_API_KEY is required for provider: ${provider}`);
  }

  return new LLMService({ provider, apiKey, model, baseURL });
}
```

#### Extraction Service (Refactored 3-Stage Pipeline)

```typescript
// lib/ai/extraction.ts
import { z } from 'zod';
import { createLLMService, type LLMService } from './service';
import { classificationPrompt, brokeragePrompt, bankPrompt, creditCardPrompt } from './prompts';

const ClassificationSchema = z.object({
  docType: z.enum(['brokerage', 'bank', 'credit_card', 'unknown']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const BrokerageSchema = z.object({
  holdings: z.array(z.object({
    symbol: z.string(),
    quantity: z.number(),
    price: z.number().optional(),
    value: z.number().optional(),
  })),
  cashBalance: z.number().optional(),
  accountValue: z.number().optional(),
  date: z.string().optional(),
});

// ... BankSchema, CreditCardSchema similarly

export async function extractFromPDF(pdfText: string): Promise<ExtractionResult> {
  const llm = createLLMService();

  // ── Stage 1: Classification ─────────────────────────────────────
  const classifyResult = await llm.generateObject({
    system: classificationPrompt.system,
    prompt: classificationPrompt.format(pdfText),
    schema: ClassificationSchema,
    temperature: 0.0, // Deterministic classification
  });

  const docType = classifyResult.content.docType;
  if (docType === 'unknown') {
    return { success: false, error: 'Could not classify document', confidence: classifyResult.content.confidence };
  }

  // ── Stage 2: Structured Extraction ──────────────────────────────
  // Schema and prompt selected by doc type
  const { schema, prompt } = getExtractionConfig(docType, pdfText);

  const extractResult = await llm.generateObject({
    system: prompt.system,
    prompt: prompt.user,
    schema,
    temperature: 0.1,
    maxTokens: 4000,
  });

  // ── Stage 3: DEPRECATED ─────────────────────────────────────────
  // generateObject() guarantees valid JSON via Zod schema.
  // No manual JSON repair needed. The SDK retries internally.
  // If it throws, we catch and return error below.

  return {
    success: true,
    docType,
    data: extractResult.content,
    metadata: {
      provider: extractResult.provider,
      model: extractResult.model,
      tokens: extractResult.usage,
      latencyMs: extractResult.latencyMs,
    },
  };
}
```

### 5.3 Environment Configuration

```bash
# .env.local

# ── Provider Selection ──
# Options: openai | anthropic | google | kimi | groq | ollama
AI_PROVIDER=openai

# ── API Key (provider-specific) ──
# Only ONE of these needs to be set, matching AI_PROVIDER
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
KIMI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
# Ollama needs no API key (local)

# ── Optional Overrides ──
AI_MODEL=gpt-4o-mini              # Override default model for this provider
AI_BASE_URL=                      # Override base URL (for proxies or local)

# ── Task-Specific Models (optional, falls back to AI_MODEL) ──
AI_CLASSIFICATION_MODEL=gpt-4o-mini
AI_EXTRACTION_MODEL=gpt-4o
AI_REPAIR_MODEL=gpt-4o-mini

# ── Fallback Provider (Phase 2) ──
AI_FALLBACK_PROVIDER=anthropic
AI_FALLBACK_API_KEY=sk-ant-...
```

### 5.4 Provider-Specific Notes

| Provider | Base URL | Models | Notes |
|----------|----------|--------|-------|
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o`, `gpt-4o-mini`, `o3-mini` | Best structured output reliability. Most expensive. |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-3-5-sonnet`, `claude-3-5-haiku` | Excellent at following complex instructions. JSON mode via `generateObject`. |
| **Google** | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash`, `gemini-2.0-pro` | Cheapest per token. 1M token context window. |
| **Kimi** | `https://api.moonshot.cn/v1` | `moonshot-v1-128k`, `moonshot-v1-32k` | OpenAI-compatible endpoint. Existing provider, minimal change. |
| **Groq** | `https://api.groq.com/openai/v1` | `llama-3.3-70b`, `mixtral-8x7b` | Extremely fast inference. Great for classification. Cheap. |
| **Ollama** | `http://localhost:11434/api` | `llama3.2`, `qwen2.5`, `mistral` | Local, zero API cost. Requires local GPU/CPU. Good for testing. |

---

## 6. Migration Path

### 6.1 Phase 1: Foundation (1 week)

| Task | Files | Effort |
|------|-------|--------|
| Install AI SDK + providers | `package.json` | 30 min |
| Create `lib/ai/` directory structure | New files | 1 hour |
| Implement provider registry | `registry.ts` | 2 hours |
| Implement LLMService | `service.ts`, `types.ts` | 3 hours |
| Port classification prompt | `prompts/classification.ts` | 1 hour |
| Port extraction prompts | `prompts/extraction.ts` | 2 hours |
| Create extraction pipeline | `extraction.ts` | 3 hours |
| Add environment variables | `.env.local`, `README` | 30 min |
| **Total** | | **~2 days** |

### 6.2 Phase 2: Integration with Next.js-Only Migration (2-3 weeks)

| Task | Depends On | Effort |
|------|-----------|--------|
| Replace `api/app/services/kimi_service.py` | Phase 1 | Rewrite as `lib/ai/service.ts` |
| Replace `api/app/services/extraction_service.py` | Phase 1 | Rewrite as `lib/ai/extraction.ts` |
| Replace `api/app/routers/upload.py` | Extraction service | Rewrite as `app/api/upload/route.ts` |
| Remove `api/app/routers/kimi_files.py` | — | Delete (local PDF parsing replaces file API) |
| Update frontend API calls | All above | Replace `listKimiFiles()` calls |
| Add provider selection UI | Phase 1 | Admin page: pick provider, test connection, view usage |
| **Total** | | **~1 week** |

### 6.3 Phase 3: Advanced Features (Future)

| Feature | Description | Library Addition |
|---------|-------------|------------------|
| **Fallback Chain** | Auto-retry with secondary provider on failure | `ai` SDK + custom retry logic |
| **Cost Tracking** | Per-request cost logging to DB | Custom middleware in `LLMService` |
| **Model A/B Testing** | Route % of traffic to new model | `LLMService` with weighted random |
| **Streaming Suggestions** | Real-time AI chat for portfolio advice | `streamText()` + `useChat()` hook |
| **Local Model Support** | Run Ollama for offline extraction | `ollama-ai-provider` |
| **Enterprise Gateway** | Centralized routing, rate limits, logging | LiteLLM Proxy (standalone) |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `generateObject()` fails with some providers | Medium | High | Wrap in try/catch; fallback to `generateText()` + manual Zod parse |
| Anthropic/ Google don't support `generateObject()` as well as OpenAI | Low | Medium | Test each provider before supporting; OpenAI as default |
| Rate limits on new provider | Medium | Medium | Implement exponential backoff; fallback provider config |
| Cost increase with OpenAI vs Kimi | High (if defaulting) | Medium | Default to cheapest provider (Groq/Gemini); let users choose |
| PDF parsing quality differs by provider | Medium | High | Benchmark extraction accuracy across providers; document in PRD |
| Breaking changes in AI SDK | Low | Medium | Pin to stable version; AI SDK has semver |

---

## 8. Acceptance Criteria

- [ ] User can set `AI_PROVIDER=openai` and extraction works with OpenAI API key
- [ ] User can set `AI_PROVIDER=anthropic` and extraction works with Anthropic API key
- [ ] User can set `AI_PROVIDER=kimi` and extraction works (backward compatible)
- [ ] No code changes required to switch providers (only env vars)
- [ ] `generateObject()` produces valid JSON matching Zod schema ≥99% of the time
- [ ] Stage 3 "JSON repair" is removed (handled by SDK)
- [ ] Kimi file management API (`/kimi-files`) is removed (replaced by local PDF parsing)
- [ ] All 27+ tests pass after migration
- [ ] Extraction latency is ≤ current Kimi pipeline (or documented if slower)

---

## 9. Appendix

### A. Comparison: Current vs. Proposed Extraction Code

**Current (Python, ~200 lines in kimi_service.py):**
```python
# Raw httpx, manual JSON parsing, 3-stage pipeline with repair fallback
response = client.post("/chat/completions", json={...})
raw = response.json()["choices"][0]["message"]["content"]
data = json.loads(raw)  # May throw → triggers repair stage
```

**Proposed (TypeScript, ~20 lines):**
```typescript
const result = await generateObject({
  model: resolveModel(config),
  schema: ExtractionSchema,
  system: prompt.system,
  prompt: prompt.user,
});
return result.object; // Fully typed, guaranteed valid
```

### B. Cost Comparison (per 1M tokens, approx. April 2026)

| Provider | Model | Input $/1M | Output $/1M | Context | Best For |
|----------|-------|-----------|------------|---------|----------|
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | 128K | Classification, cheap tasks |
| OpenAI | gpt-4o | $2.50 | $10.00 | 128K | Complex extraction |
| Anthropic | claude-3-5-haiku | $0.80 | $4.00 | 200K | Fast, large context |
| Anthropic | claude-3-5-sonnet | $3.00 | $15.00 | 200K | High accuracy |
| Google | gemini-2.0-flash | $0.075 | $0.30 | 1M | Cheapest overall |
| Kimi | moonshot-v1-128k | ~$0.50 | ~$2.00 | 128K | Current provider |
| Groq | llama-3.3-70b | $0.59 | $0.79 | 128K | Fastest inference |

> **Recommendation:** Default to `google` (Gemini Flash) for cost, `openai` (GPT-4o-mini) for reliability, or `groq` for speed. Let users override.

### C. Provider Compatibility Matrix

| Feature | OpenAI | Anthropic | Google | Kimi | Groq | Ollama |
|---------|--------|-----------|--------|------|------|--------|
| `generateText` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `generateObject` (Zod) | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| `streamText` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tool Calling | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Image Input | ✅ | ✅ | ✅ | ✅ | ❌ | ⚠️ |
| JSON Mode | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |

---

## 10. Related Documents

- `ERDs/ERD-NextJS-Only.md` — Database schema for Next.js-only architecture
- `ERDs/IMPLEMENTATION_PLAN-NextJS-Only.md` — Migration timeline
- `docs/PRDs/PRD-NextJS-Only-Architecture.md` — Parent PRD (removes Python backend)
- `api/app/services/kimi_service.py` — Current implementation (to be replaced)
- `api/app/services/extraction_service.py` — Current orchestrator (to be replaced)
