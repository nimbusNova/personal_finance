# ERD: LLM Provider Abstraction

> **Corresponds to:** [PRD: LLM Provider Abstraction](../PRDs/PRD-LLM-Provider-Abstraction.md)  
> **Parent ERD:** [ERD-NextJS-Only.md](./ERD-NextJS-Only.md)  
> **Last updated:** 2026-04-19  
> **Stack:** Next.js 14, Drizzle ORM, better-sqlite3, Vercel AI SDK

---

## What Changed From Previous Schema

### New Tables

| Table | Purpose | Phase |
|-------|---------|-------|
| `ai_usage_logs` | Per-request token usage, cost, latency, outcome tracking | 1 |

### New JSON Files (Local-First Settings)

| File | Purpose | Notes |
|------|---------|-------|
| `data/ai-providers.json` | User-configured LLM provider credentials | Replaces `ai_provider_configs` table. Consistent with existing `data/settings.json` pattern. |

> **Why JSON instead of a DB table?** This is a single-user local app. A JSON file is simpler, requires no migration, and aligns with the existing `settings.json` pattern. The array of provider objects is small (< 10 items) and read in full on every LLM call. No query/filtering benefits justify the ORM overhead.

### Modified Tables

| Table | Change | Reason |
|-------|--------|--------|
| `pdfs` | `+ provider TEXT` | Which LLM provider processed this PDF |
| `pdfs` | `+ model TEXT` | Which model was used for extraction |
| `pdfs` | `+ token_usage_json TEXT` | Prompt/completion token breakdown |
| `extraction_jobs` | `+ provider TEXT` | Provider that ran this job |
| `extraction_jobs` | `+ model TEXT` | Model used for this job |
| `extraction_jobs` | `+ latency_ms INTEGER` | Request round-trip time |

---

## 1. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LLM PROVIDER ABSTRACTION — NEW ENTITIES                   │
│                           (additions to existing schema)                     │
└─────────────────────────────────────────────────────────────────────────────┘

Local JSON config (NOT in DB):
  data/ai-providers.json  ──►  [{name, provider, apiKey, baseURL, defaultModel,
                                 taskModels, isActive, isFallback, priority}]

Existing tables (unchanged structure):
  institutions, accounts, pdfs*, portfolio_snapshots, holdings,
  transactions, account_balances, life_stage_profiles, ai_suggestions,
  monthly_reports, manual_corrections, extraction_jobs*

                              ┌──────────────────────┐
                              │   ai_usage_logs      │
                              ├──────────────────────┤
                              │ id PK                │
                              │ task_type TEXT       │
                              │ provider TEXT        │
                              │ model TEXT           │
                              │ prompt_tokens INT    │
                              │ completion_tokens INT│
                              │ total_tokens INT     │
                              │ cost_estimate REAL   │
                              │ latency_ms INT       │
                              │ success BOOLEAN      │
                              │ error_message TEXT   │
                              │ pdf_id FK (nullable) │◄────► pdfs.id
                              │ created_at           │
                              └──────────────────────┘
                                                           │
                              ┌────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │      pdfs       │◄───── existing (modified)
                    ├─────────────────┤
                    │ ...             │
                    │ provider TEXT   │◄──── NEW
                    │ model TEXT      │◄──── NEW
                    │ token_usage_json│◄──── NEW
                    │ ...             │
                    └────────┬────────┘
                             │
                             │ 1:N
                             ▼
                    ┌─────────────────┐
                    │ extraction_jobs │◄───── existing (modified)
                    ├─────────────────┤
                    │ ...             │
                    │ provider TEXT   │◄──── NEW
                    │ model TEXT      │◄──── NEW
                    │ latency_ms INT  │◄──── NEW
                    │ ...             │
                    └─────────────────┘
```

---

## 2. Drizzle ORM Schema (Additions)

```typescript
// web/lib/db/schema.ts — additions only

import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core';

// ── AI Usage Logs ───────────────────────────────────────────────────────────
export const aiUsageLogs = sqliteTable('ai_usage_logs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  taskType: text('task_type', {
    enum: ['classification', 'extraction', 'repair', 'suggestion', 'report', 'chat']
  }).notNull(),
  provider: text('provider').notNull(),            // denormalized for fast queries
  model: text('model').notNull(),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  costEstimate: real('cost_estimate'),             // USD, estimated from token counts
  latencyMs: integer('latency_ms'),
  success: integer('success', { mode: 'boolean' }).default(true),
  errorMessage: text('error_message'),
  pdfId: integer('pdf_id').references(() => pdfs.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  pdfIdx: index('idx_usage_pdf').on(table.pdfId),
  taskIdx: index('idx_usage_task').on(table.taskType, table.createdAt),
  providerIdx: index('idx_usage_provider').on(table.provider, table.createdAt),
}));
```

### JSON Config Schema (data/ai-providers.json)

```typescript
// web/lib/ai/config.ts — runtime types for the JSON file

export interface AIProviderConfig {
  name: string;                                    // "primary-openai", "backup-groq"
  provider: AIProvider;
  apiKey: string;                                  // plain text (local file, user-owned)
  baseURL?: string;                                // optional proxy / local override
  defaultModel: string;
  taskModels?: {
    classification?: string;
    extraction?: string;
    repair?: string;
  };
  isActive: boolean;
  isFallback: boolean;
  priority: number;                                // 1 = primary, higher = backup
}

// Example data/ai-providers.json
[
  {
    "name": "primary-openai",
    "provider": "openai",
    "apiKey": "sk-...",
    "defaultModel": "gpt-4o-mini",
    "taskModels": {
      "classification": "gpt-4o-mini",
      "extraction": "gpt-4o",
      "repair": "gpt-4o-mini"
    },
    "isActive": true,
    "isFallback": false,
    "priority": 1
  },
  {
    "name": "backup-groq",
    "provider": "groq",
    "apiKey": "gsk_...",
    "defaultModel": "llama-3.3-70b-versatile",
    "isActive": true,
    "isFallback": true,
    "priority": 2
  }
]
```

### Modified Existing Tables

```typescript
// Additions to existing `pdfs` table
// provider: text('provider'),          // "openai" | "anthropic" | ...
// model: text('model'),                // "gpt-4o" | "claude-3-5-sonnet" | ...
// tokenUsageJson: text('token_usage_json', { mode: 'json' }),
// // ^ { promptTokens: 1234, completionTokens: 567, totalTokens: 1801 }

// Additions to existing `extraction_jobs` table
// provider: text('provider'),
// model: text('model'),
// latencyMs: integer('latency_ms'),
```

---

## 3. SQLite DDL (Migration)

```sql
-- ============================================
-- 1. AI Usage Logs
-- ============================================
CREATE TABLE ai_usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_type TEXT NOT NULL CHECK(task_type IN ('classification','extraction','repair','suggestion','report','chat')),
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_estimate REAL,
    latency_ms INTEGER,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    pdf_id INTEGER REFERENCES pdfs(id) ON DELETE SET NULL,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_usage_pdf ON ai_usage_logs(pdf_id);
CREATE INDEX idx_usage_task ON ai_usage_logs(task_type, created_at DESC);
CREATE INDEX idx_usage_provider ON ai_usage_logs(provider, created_at DESC);

-- ============================================
-- 2. Modify existing tables
-- ============================================
-- SQLite: ALTER TABLE ADD COLUMN is limited but sufficient here
ALTER TABLE pdfs ADD COLUMN provider TEXT;
ALTER TABLE pdfs ADD COLUMN model TEXT;
ALTER TABLE pdfs ADD COLUMN token_usage_json TEXT;

ALTER TABLE extraction_jobs ADD COLUMN provider TEXT;
ALTER TABLE extraction_jobs ADD COLUMN model TEXT;
ALTER TABLE extraction_jobs ADD COLUMN latency_ms INTEGER;

-- ============================================
-- 3. Create JSON config file (app bootstraps if missing)
-- ============================================
-- data/ai-providers.json is created at runtime if it doesn't exist.
-- Default: [] (empty array → falls back to env vars)
```

---

## 4. Code Architecture (TypeScript)

The LLM abstraction lives entirely in the application layer. These are not DB entities but module boundaries.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        lib/ai/ MODULE ARCHITECTURE                           │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                  │
│   │   prompts/  │     │   types.ts  │     │  registry.ts│                  │
│   │  (static)   │     │  (contracts)│     │  (factory)  │                  │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘                  │
│          │                   │                   │                          │
│          └───────────────────┼───────────────────┘                          │
│                              │                                               │
│                              ▼                                               │
│                     ┌─────────────────┐                                      │
│                     │   service.ts    │  LLMService: generateText/Object    │
│                     │  (business      │  + logging + fallback + retry       │
│                     │   logic)        │                                      │
│                     └────────┬────────┘                                      │
│                              │                                               │
│              ┌───────────────┼───────────────┐                               │
│              │               │               │                               │
│              ▼               ▼               ▼                               │
│      ┌────────────┐  ┌────────────┐  ┌────────────┐                         │
│      │ provider.ts│  │extraction.ts│  │fallback.ts │                         │
│      │(Vercel SDK │  │(3-stage    │  │(chain:     │                         │
│      │  wrapper)  │  │  pipeline) │  │ primary→   │                         │
│      └────────────┘  │            │  │ secondary) │                         │
│                      └────────────┘  └────────────┘                         │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         app/api/ai/                                  │   │
│   │  POST /classify  ──► classify route ──► LLMService.generateObject   │   │
│   │  POST /extract   ──► extract route  ──► extraction pipeline         │   │
│   │  POST /generate  ──► generic route  ──► LLMService.generateText    │   │
│   │  POST /stream    ──► streaming route ──► LLMService.streamText     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Core Types (lib/ai/types.ts)

```typescript
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
  schema?: import('zod').ZodSchema;
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
  generateObject<T>(options: GenerateOptions & { schema: import('zod').ZodSchema<T> }): Promise<GenerateResult<T>>;
  streamText(options: GenerateOptions): AsyncIterable<string>;
}
```

### 4.2 Service Layer (lib/ai/service.ts)

```typescript
export class LLMService {
  private primary: LLMProvider;
  private fallback?: LLMProvider;
  private configName?: string;   // references ai-providers.json[n].name

  constructor(primary: LLMProvider, fallback?: LLMProvider, configName?: string) {
    this.primary = primary;
    this.fallback = fallback;
    this.configName = configName;
  }

  async generateObject<T>(
    options: GenerateOptions & { schema: z.ZodSchema<T> },
    meta?: { taskType: AITaskType; pdfId?: number }
  ): Promise<GenerateResult<T>> {
    const start = Date.now();
    try {
      const result = await this.primary.generateObject(options);
      await this.logUsage({ ...result, taskType: meta?.taskType ?? 'extraction', pdfId: meta?.pdfId, success: true, latencyMs: Date.now() - start });
      return result;
    } catch (err) {
      if (this.fallback) {
        const result = await this.fallback.generateObject(options);
        await this.logUsage({ ...result, taskType: meta?.taskType ?? 'extraction', pdfId: meta?.pdfId, success: true, latencyMs: Date.now() - start });
        return result;
      }
      await this.logUsage({ provider: this.primary.name, model: 'unknown', taskType: meta?.taskType ?? 'extraction', pdfId: meta?.pdfId, success: false, errorMessage: String(err), latencyMs: Date.now() - start });
      throw err;
    }
  }

  private async logUsage(log: Partial<AIUsageLog>): Promise<void> {
    // Insert into ai_usage_logs table
    // Non-blocking: fire-and-forget with catch
  }
}
```

### 4.3 Extraction Pipeline (lib/ai/extraction.ts)

```typescript
export interface ExtractionResult {
  success: boolean;
  docType?: 'brokerage' | 'bank' | 'credit_card' | 'unknown';
  data?: unknown;
  error?: string;
  confidence?: number;
  metadata?: {
    provider: AIProvider;
    model: string;
    tokens?: { promptTokens: number; completionTokens: number; totalTokens: number };
    latencyMs: number;
  };
}

export async function extractFromPDF(pdfText: string, pdfId: number): Promise<ExtractionResult> {
  const llm = await createLLMService(); // reads ai_provider_configs or env fallback

  // Stage 1: Classification
  const classify = await llm.generateObject(
    { system: CLASSIFY_SYSTEM, prompt: pdfText, schema: ClassificationSchema, temperature: 0 },
    { taskType: 'classification', pdfId }
  );

  if (classify.content.docType === 'unknown') {
    return { success: false, error: 'Unclassifiable document', confidence: classify.content.confidence };
  }

  // Stage 2: Structured Extraction
  const { schema, prompt } = getExtractionConfig(classify.content.docType, pdfText);
  const extract = await llm.generateObject(
    { system: prompt.system, prompt: prompt.user, schema, temperature: 0.1, maxTokens: 4000 },
    { taskType: 'extraction', pdfId }
  );

  return {
    success: true,
    docType: classify.content.docType,
    data: extract.content,
    confidence: classify.content.confidence,
    metadata: {
      provider: extract.provider,
      model: extract.model,
      tokens: extract.usage,
      latencyMs: extract.latencyMs,
    },
  };
}
```

---

## 5. API Routes

| Route | Method | Body | Response | Purpose |
|-------|--------|------|----------|---------|
| `/api/ai/classify` | POST | `{ text: string }` | `{ docType, confidence, reasoning }` | Document type detection |
| `/api/ai/extract` | POST | `{ text: string, pdfId?: number }` | `ExtractionResult` | Full extraction pipeline |
| `/api/ai/generate` | POST | `{ system?, prompt, temperature?, maxTokens? }` | `{ text, usage, provider, model }` | Generic text generation |
| `/api/ai/stream` | POST | `{ system?, prompt }` | `text/event-stream` | Streaming response |
| `/api/ai/providers` | GET | — | `{ providers: AIProviderConfig[] }` | List configured providers |
| `/api/ai/providers` | POST | `AIProviderConfig` | `{ id }` | Add/update provider config |
| `/api/ai/usage` | GET | `?from=&to=&provider=` | `{ logs: AIUsageLog[], totalCost }` | Usage dashboard data |

---

## 6. Configuration Resolution Order

```
1. JSON: data/ai-providers.json
   └── Filter is_active = true, sort by priority
   └── If array non-empty → use first entry as primary, second as fallback

2. Environment fallback (backward compatible):
   AI_PROVIDER  → provider
   OPENAI_API_KEY / ANTHROPIC_API_KEY / ... → apiKey
   AI_MODEL / AI_CLASSIFICATION_MODEL / AI_EXTRACTION_MODEL → models

3. Hardcoded defaults (last resort):
   provider = "openai"
   model = "gpt-4o-mini"
```

---

## 7. Data Flow (Extraction with Provider Abstraction)

```
User uploads PDF
       │
       ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  POST /api/ │────►│  pdfs row   │────►│ extraction_jobs │
│   upload    │     │  (pending)  │     │   (queued)      │
└─────────────┘     └─────────────┘     └─────────────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │  resolveConfig()│
                                       │  (DB → env →   │
                                       │   default)      │
                                       └────────┬────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │ LLMService      │
                                       │  .generateObject│
                                       │  (classify)     │
                                       └────────┬────────┘
                                                │
                        ┌───────────────────────┼───────────────────────┐
                        │                       │                       │
                        ▼                       ▼                       ▼
                 ┌────────────┐        ┌────────────┐        ┌────────────┐
                 │  openai()  │        │ anthropic()│        │   kimi()   │
                 │  gpt-4o    │        │claude-sonnet│       │ moonshot   │
                 └─────┬──────┘        └─────┬──────┘        └─────┬──────┘
                       │                     │                     │
                       └─────────────────────┼─────────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │ generateObject()│
                                    │  (Vercel AI SDK)│
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  ai_usage_logs  │◄── token/cost/latency
                                    │     (insert)    │
                                    └─────────────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  .generateObject│
                                    │  (extract)      │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │  pdfs row UPDATE│
                                    │ provider, model,│
                                    │ token_usage_json│
                                    └─────────────────┘
```

---

## 8. Relationships Summary

| Parent | Child | Type | On Delete |
|--------|-------|------|-----------|
| pdfs | ai_usage_logs | 1:N | SET NULL |

---

## 9. Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| ai_usage_logs | idx_usage_pdf | pdf_id | Trace extraction cost |
| ai_usage_logs | idx_usage_task | task_type, created_at | Task breakdown |
| ai_usage_logs | idx_usage_provider | provider, created_at | Provider comparison |

---

## 10. Security Notes

- **API Keys:** Stored in `data/ai-providers.json` as plain text. This is a local-first single-user app; the file lives on the user's machine alongside their financial data. No network exposure.
- **No keys in repo:** `data/ai-providers.json` is in `.gitignore`.
- **Log redaction:** `ai_usage_logs.error_message` must never contain raw API keys or PDF text.
- **Local-first:** Since this is a single-user local app, file-system permissions are the security boundary.

---

## 11. NavBar Integration — AI Usage Badge

The `ai_usage_logs` table enables a lightweight cost/usage indicator in the NavBar.

### 11.1 Proposed NavBar Item

```
┌─────────────────────────────────────────────────────────────┐
│  Dashboard  Upload  Accounts  Holdings  [⚡ $0.42]  Settings│
│                                         ^^^^^^^^^           │
│                                    mini usage badge         │
└─────────────────────────────────────────────────────────────┘
```

**Behavior:**
- **Default:** Shows month-to-date estimated cost (e.g., "⚡ $0.42")
- **Hover:** Tooltip with breakdown — total requests, tokens used, top provider
- **Click:** Navigates to `/usage` page with full dashboard
- **Empty state:** Hidden or shows "—" if no usage this month
- **Alert:** Turns amber/red if daily cost exceeds a configurable threshold

### 11.2 API for Badge Data

```typescript
// app/api/ai/usage/summary/route.ts
export async function GET() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  const rows = db.select({
    totalCost: sum(aiUsageLogs.costEstimate),
    totalRequests: count(),
    totalTokens: sum(aiUsageLogs.totalTokens),
  })
  .from(aiUsageLogs)
  .where(gte(aiUsageLogs.createdAt, startOfMonth))
  .all();

  return Response.json({
    monthToDateCost: rows[0]?.totalCost ?? 0,
    totalRequests: rows[0]?.totalRequests ?? 0,
    totalTokens: rows[0]?.totalTokens ?? 0,
  });
}
```

### 11.3 Usage Dashboard Page (`/usage`)

| Widget | Data Source | Description |
|--------|-------------|-------------|
| Cost over time | `ai_usage_logs` daily rollup | Line chart: cost per day this month |
| Provider breakdown | `ai_usage_logs` group by provider | Pie chart: % cost by provider |
| Task breakdown | `ai_usage_logs` group by task_type | Bar chart: requests per task |
| Recent calls | `ai_usage_logs` last 50 rows | Table: provider, model, tokens, cost, latency, success |
| PDF traceability | Join `ai_usage_logs` + `pdfs` | Click a log row → jump to the PDF it processed |

### 11.4 Schema Addition for Threshold Alert

```sql
-- Add to data/settings.json (no DB change needed)
{
  "aiDailyCostThreshold": 5.00,   -- USD, alert if exceeded
  "aiMonthlyBudget": 50.00        -- USD, soft cap warning
}
```

## 12. Phase 2 Additions (Future)

| Feature | Schema Change | Notes |
|---------|--------------|-------|
| Model A/B testing | `ai_ab_tests` table (model_a, model_b, split_pct, metric) | Route % traffic to new model |
| Fallback chain config | `ai-providers.json` supports ordered `fallbackChain` array | No DB change |
| Rate limit tracking | `ai_usage_logs.rate_limited BOOLEAN` | Detect provider throttling |
| Streaming chat history | `chat_sessions`, `chat_messages` tables | For `useChat()` hook persistence |

---

## 13. Changelog

### 2026-04-19 (v1.0)
- **Added:** `data/ai-providers.json` — multi-provider credential storage (JSON file, not DB table)
- **Added:** `ai_usage_logs` table — per-request cost/latency/usage tracking
- **Modified:** `pdfs` — added `provider`, `model`, `token_usage_json`
- **Modified:** `extraction_jobs` — added `provider`, `model`, `latency_ms`
- **Defined:** `lib/ai/` module architecture, service boundaries, API contracts
