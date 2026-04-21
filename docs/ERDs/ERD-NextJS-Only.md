# ERD: Next.js Only Architecture (SQLite + Drizzle ORM)

**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Draft  
**Stack:** Next.js 14, better-sqlite3, Drizzle ORM, TypeScript

---

## 1. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTITY RELATIONSHIP DIAGRAM                          │
│                     Next.js Only — SQLite (better-sqlite3)                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  institutions    │         │      users       │         │life_stage_profiles│
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ id PK            │         │ id PK            │         │ id PK            │
│ name             │         │ email UK         │         │ user_id FK       │◄─┐
│ type             │         │ password_hash    │         │ age              │  │
│ logo_url         │         │ created_at       │         │ annual_income    │  │
│ created_at       │         │ updated_at       │         │ risk_tolerance   │  │
└────────┬─────────┘         └────────┬─────────┘         │ time_horizon     │  │
         │                            │                   │ goals_json       │  │
         │                            │                   │ target_allocation│  │
         │                            │                   │ manifesto_text   │  │
         │                            │                   │ is_active        │  │
         │                            │                   │ version          │  │
         │                            │                   │ created_at       │  │
         │                            └────────┬──────────┘                  │
         │                                     │                             │
         │         ┌──────────────────┐        │                             │
         │         │     accounts     │◄───────┘                             │
         │         ├──────────────────┤                                      │
         └────────►│ id PK            │                                      │
                   │ user_id FK       │◄─────────────────────────────────────┘
                   │ institution_id FK│
                   │ name             │
                   │ account_type     │
                   │ account_number_masked
                   │ is_active        │
                   │ created_at       │
                   └────────┬─────────┘
                            │
           ┌────────────────┼────────────────┐
           │                │                │
           ▼                ▼                ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│      pdfs        │ │portfolio_    │ │  transactions    │
├──────────────────┤ │  snapshots   │ ├──────────────────┤
│ id PK            │ ├──────────────┤ │ id PK            │
│ account_id FK    │ │ id PK        │ │ account_id FK    │
│ original_filename│ │ account_id FK│ │ pdf_id FK        │
│ file_path UK     │ │ pdf_id FK UK │ │ date             │
│ file_size        │ │ statement_dt │ │ merchant         │
│ page_count       │ │ total_value  │ │ category         │
│ doc_type         │ │ cash_balance │ │ amount           │
│ extraction_status│ │ invested_val │ │ is_recurring     │
│ processing_step  │ │ diversity_scr│ │ recurring_freq   │
│ extraction_conf  │ │ created_at   │ │ statement_date   │
│ extracted_data   │ └──────┬───────┘ │ is_manual_corr   │
│ error_message    │        │         │ created_at       │
│ processed_at     │        │         └──────────────────┘
│ created_at       │        │
└────────┬─────────┘        │
         │                  │
         │    ┌─────────────┼─────────────┐
         │    │             │             │
         │    ▼             ▼             ▼
         │ ┌────────┐ ┌──────────┐ ┌──────────────┐
         │ │holdings│ │ manual_  │ │account_      │
         │ ├────────┤ │corrections│ │balances      │
         │ │id PK   │ ├──────────┤ ├──────────────┤
         │ │snap_id │ │id PK     │ │id PK         │
         │ │symbol  │ │pdf_id FK │ │account_id FK │
         │ │name    │ │field_name│ │pdf_id FK     │
         │ │...     │ │orig_val  │ │statement_date│
         │ └────────┘ │corr_val  │ │balance       │
         │            │...       │ │currency      │
         │            └──────────┘ │created_at    │
         │                         └──────────────┘
         │
         │         ┌──────────────────┐
         │         │ extraction_jobs  │
         │         ├──────────────────┤
         │         │ id PK            │
         └────────►│ pdf_id FK        │
                   │ job_type         │
                   │ status           │
                   │ attempts         │
                   │ error_details    │
                   │ started_at       │
                   │ completed_at     │
                   │ created_at       │
                   └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│ ai_suggestions   │         │ monthly_reports  │
├──────────────────┤         ├──────────────────┤
│ id PK            │         │ id PK            │
│ life_stage_id FK │◄────────│ year             │
│ suggestion_type  │         │ month            │
│ action_json      │         │ generated_at     │
│ reasoning_text   │         │ summary_text     │
│ reasoning_json   │         │ metrics_json     │
│ confidence_score │         │ suggestions_count│
│ priority         │         │ status           │
│ portfolio_context│         │ error_message    │
│ user_feedback    │         │ created_at       │
│ user_note        │         │ year+month UK    │
│ is_active        │         └──────────────────┘
│ created_at       │
└──────────────────┘
```

---

## 2. Drizzle ORM Schema (TypeScript)

```typescript
// web/lib/db/schema.ts
import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ── Institutions ────────────────────────────────────────────────────────────
export const institutions = sqliteTable('institutions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['brokerage', 'bank', 'credit_card'] }),
  logoUrl: text('logo_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ── Accounts ────────────────────────────────────────────────────────────────
export const accounts = sqliteTable('accounts', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  institutionId: integer('institution_id').notNull().references(() => institutions.id),
  name: text('name').notNull(),
  accountType: text('account_type'), // 401k, IRA, taxable, checking, etc
  accountNumberMasked: text('account_number_masked'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  unq: uniqueIndex('uix_account_user_institution_name').on(table.userId, table.institutionId, table.name),
}));

// ── Life Stage Profiles ─────────────────────────────────────────────────────
export const lifeStageProfiles = sqliteTable('life_stage_profiles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  age: integer('age'),
  annualIncome: real('annual_income'),
  riskTolerance: integer('risk_tolerance'), // 1-10
  timeHorizonYears: integer('time_horizon_years'),
  goalsJson: text('goals_json', { mode: 'json' }),
  targetAllocationJson: text('target_allocation_json', { mode: 'json' }),
  manifestoText: text('manifesto_text'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  version: integer('version').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ── PDFs ────────────────────────────────────────────────────────────────────
export const pdfs = sqliteTable('pdfs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  originalFilename: text('original_filename'),
  filePath: text('file_path').notNull().unique(),
  fileSize: integer('file_size'),
  pageCount: integer('page_count'),
  docType: text('doc_type', { enum: ['brokerage', 'credit_card', 'bank'] }),
  extractionStatus: text('extraction_status', {
    enum: ['pending', 'processing', 'completed', 'failed', 'manual_review']
  }).default('pending'),
  processingStep: text('processing_step'),
  extractionConfidence: real('extraction_confidence'),
  extractedData: text('extracted_data', { mode: 'json' }),
  errorMessage: text('error_message'),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  statusIdx: index('idx_pdfs_status').on(table.accountId, table.extractionStatus),
}));

// ── Extraction Jobs ─────────────────────────────────────────────────────────
export const extractionJobs = sqliteTable('extraction_jobs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  pdfId: integer('pdf_id').notNull().references(() => pdfs.id, { onDelete: 'cascade' }),
  jobType: text('job_type', { enum: ['extraction', 'reprocessing'] }).notNull(),
  status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending'),
  attempts: integer('attempts').default(0),
  errorDetails: text('error_details', { mode: 'json' }),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  pdfIdx: index('idx_extraction_jobs_pdf').on(table.pdfId),
  statusIdx: index('idx_extraction_jobs_status').on(table.status),
}));

// ── Manual Corrections ──────────────────────────────────────────────────────
export const manualCorrections = sqliteTable('manual_corrections', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  pdfId: integer('pdf_id').notNull().references(() => pdfs.id, { onDelete: 'cascade' }),
  fieldName: text('field_name').notNull(), // e.g., "holdings.VTI.quantity"
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  correctedBy: text('corrected_by').default('user'),
  correctionNote: text('correction_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ── Account Balances ────────────────────────────────────────────────────────
export const accountBalances = sqliteTable('account_balances', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  pdfId: integer('pdf_id').references(() => pdfs.id),
  statementDate: integer('statement_date', { mode: 'timestamp' }),
  balance: real('balance'),
  currency: text('currency').default('USD'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  unq: uniqueIndex('uix_balance_account_date').on(table.accountId, table.statementDate),
}));

// ── Portfolio Snapshots ─────────────────────────────────────────────────────
export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  pdfId: integer('pdf_id').unique().references(() => pdfs.id, { onDelete: 'set null' }),
  statementDate: integer('statement_date', { mode: 'timestamp' }).notNull(),
  totalValue: real('total_value'),
  cashBalance: real('cash_balance'),
  investedValue: real('invested_value'),
  diversityScore: real('diversity_score'), // 0-100
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  unq: uniqueIndex('uix_snapshot_account_date').on(table.accountId, table.statementDate),
  accountIdx: index('idx_snapshots_account').on(table.accountId, table.statementDate),
}));

// ── Holdings ────────────────────────────────────────────────────────────────
export const holdings = sqliteTable('holdings', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id').notNull().references(() => portfolioSnapshots.id, { onDelete: 'cascade' }),
  symbol: text('symbol').notNull(),
  name: text('name'),
  assetClass: text('asset_class'), // equity, bond, commodity, etc
  sector: text('sector'),
  geography: text('geography'), // US, international, emerging
  quantity: real('quantity'),
  price: real('price'),
  marketValue: real('market_value'),
  costBasis: real('cost_basis'),
  unrealizedPnl: real('unrealized_pnl'),
  weightPct: real('weight_pct'),
  isManualCorrection: integer('is_manual_correction', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  unq: uniqueIndex('uix_holding_snapshot_symbol').on(table.snapshotId, table.symbol),
  snapshotIdx: index('idx_holdings_snapshot').on(table.snapshotId),
  symbolIdx: index('idx_holdings_symbol').on(table.symbol),
}));

// ── Transactions ────────────────────────────────────────────────────────────
export const transactions = sqliteTable('transactions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  pdfId: integer('pdf_id').references(() => pdfs.id, { onDelete: 'set null' }),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  merchant: text('merchant'),
  category: text('category'),
  amount: real('amount').notNull(),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  recurringFrequency: text('recurring_frequency'), // monthly, yearly
  statementDate: integer('statement_date', { mode: 'timestamp' }),
  isManualCorrection: integer('is_manual_correction', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  accountIdx: index('idx_transactions_account').on(table.accountId, table.date),
  dateIdx: index('idx_transactions_date').on(table.date),
  categoryIdx: index('idx_transactions_category').on(table.category),
}));

// ── AI Suggestions ──────────────────────────────────────────────────────────
export const aiSuggestions = sqliteTable('ai_suggestions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  lifeStageProfileId: integer('life_stage_profile_id').references(() => lifeStageProfiles.id, { onDelete: 'set null' }),
  suggestionType: text('suggestion_type'), // rebalance, buy, sell, diversify, spending
  actionJson: text('action_json', { mode: 'json' }),
  reasoningText: text('reasoning_text'),
  reasoningJson: text('reasoning_json', { mode: 'json' }),
  confidenceScore: real('confidence_score'),
  priority: text('priority', { enum: ['high', 'medium', 'low'] }),
  portfolioContext: text('portfolio_context', { mode: 'json' }),
  userFeedback: text('user_feedback', { enum: ['accept', 'reject', 'snooze', 'done'] }),
  userNote: text('user_note'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  activeIdx: index('idx_suggestions_active').on(table.isActive, table.createdAt),
  profileIdx: index('idx_suggestions_profile').on(table.lifeStageProfileId),
}));

// ── Monthly Reports ─────────────────────────────────────────────────────────
export const monthlyReports = sqliteTable('monthly_reports', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  generatedAt: integer('generated_at', { mode: 'timestamp' }),
  summaryText: text('summary_text'),
  metricsJson: text('metrics_json', { mode: 'json' }),
  suggestionsCount: integer('suggestions_count'),
  status: text('status', { enum: ['pending', 'generating', 'completed', 'failed'] }).default('pending'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  unq: uniqueIndex('uix_report_year_month').on(table.year, table.month),
  yearMonthIdx: index('idx_reports_year_month').on(table.year, table.month),
}));
```

---

## 3. SQLite DDL (Migration)

```sql
-- Enable foreign keys and WAL mode
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ── Users ──
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
);

-- ── Institutions ──
CREATE TABLE institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('brokerage', 'bank', 'credit_card')),
    logo_url TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

-- ── Accounts ──
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_id INTEGER NOT NULL REFERENCES institutions(id),
    name TEXT NOT NULL,
    account_type TEXT,
    account_number_masked TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, institution_id, name)
);

-- ── Life Stage Profiles ──
CREATE TABLE life_stage_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER,
    annual_income REAL,
    risk_tolerance INTEGER CHECK(risk_tolerance BETWEEN 1 AND 10),
    time_horizon_years INTEGER,
    goals_json TEXT,
    target_allocation_json TEXT,
    manifesto_text TEXT,
    is_active INTEGER DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch())
);

-- ── PDFs ──
CREATE TABLE pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    original_filename TEXT,
    file_path TEXT NOT NULL UNIQUE,
    file_size INTEGER,
    page_count INTEGER,
    doc_type TEXT CHECK(doc_type IN ('brokerage', 'credit_card', 'bank')),
    extraction_status TEXT DEFAULT 'pending' CHECK(extraction_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')),
    processing_step TEXT,
    extraction_confidence REAL,
    extracted_data TEXT,
    error_message TEXT,
    processed_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_pdfs_status ON pdfs(account_id, extraction_status);

-- ── Extraction Jobs ──
CREATE TABLE extraction_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK(job_type IN ('extraction', 'reprocessing')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    error_details TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_extraction_jobs_pdf ON extraction_jobs(pdf_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);

-- ── Manual Corrections ──
CREATE TABLE manual_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    corrected_by TEXT DEFAULT 'user',
    correction_note TEXT,
    created_at INTEGER DEFAULT (unixepoch())
);

-- ── Account Balances ──
CREATE TABLE account_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pdf_id INTEGER REFERENCES pdfs(id),
    statement_date INTEGER,
    balance REAL,
    currency TEXT DEFAULT 'USD',
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(account_id, statement_date)
);

-- ── Portfolio Snapshots ──
CREATE TABLE portfolio_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pdf_id INTEGER UNIQUE REFERENCES pdfs(id) ON DELETE SET NULL,
    statement_date INTEGER NOT NULL,
    total_value REAL,
    cash_balance REAL,
    invested_value REAL,
    diversity_score REAL,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(account_id, statement_date)
);
CREATE INDEX idx_snapshots_account ON portfolio_snapshots(account_id, statement_date DESC);

-- ── Holdings ──
CREATE TABLE holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES portfolio_snapshots(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT,
    asset_class TEXT,
    sector TEXT,
    geography TEXT,
    quantity REAL,
    price REAL,
    market_value REAL,
    cost_basis REAL,
    unrealized_pnl REAL,
    weight_pct REAL,
    is_manual_correction INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(snapshot_id, symbol)
);
CREATE INDEX idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);

-- ── Transactions ──
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pdf_id INTEGER REFERENCES pdfs(id) ON DELETE SET NULL,
    date INTEGER NOT NULL,
    merchant TEXT,
    category TEXT,
    amount REAL NOT NULL,
    is_recurring INTEGER DEFAULT 0,
    recurring_frequency TEXT,
    statement_date INTEGER,
    is_manual_correction INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_transactions_account ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);

-- ── AI Suggestions ──
CREATE TABLE ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    life_stage_profile_id INTEGER REFERENCES life_stage_profiles(id) ON DELETE SET NULL,
    suggestion_type TEXT,
    action_json TEXT,
    reasoning_text TEXT,
    reasoning_json TEXT,
    confidence_score REAL,
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
    portfolio_context TEXT,
    user_feedback TEXT CHECK(user_feedback IN ('accept', 'reject', 'snooze', 'done')),
    user_note TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX idx_suggestions_active ON ai_suggestions(is_active, created_at DESC);
CREATE INDEX idx_suggestions_profile ON ai_suggestions(life_stage_profile_id);

-- ── Monthly Reports ──
CREATE TABLE monthly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
    generated_at INTEGER,
    summary_text TEXT,
    metrics_json TEXT,
    suggestions_count INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(year, month)
);
CREATE INDEX idx_reports_year_month ON monthly_reports(year, month DESC);

-- ── Seed Data ──
INSERT INTO institutions (name, type) VALUES
    ('Charles Schwab', 'brokerage'),
    ('Fidelity', 'brokerage'),
    ('Vanguard', 'brokerage'),
    ('Chase', 'credit_card'),
    ('American Express', 'credit_card'),
    ('Bank of America', 'bank'),
    ('Wells Fargo', 'bank'),
    ('Robinhood', 'brokerage');
```

---

## 4. TypeScript Types (Shared)

```typescript
// web/lib/db/types.ts
export interface User {
  id: number;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Institution {
  id: number;
  name: string;
  type: 'brokerage' | 'bank' | 'credit_card' | null;
  logoUrl: string | null;
  createdAt: Date;
}

export interface Account {
  id: number;
  userId: number;
  institutionId: number;
  name: string;
  accountType: string | null;
  accountNumberMasked: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface PDF {
  id: number;
  accountId: number | null;
  originalFilename: string | null;
  filePath: string;
  fileSize: number | null;
  pageCount: number | null;
  docType: 'brokerage' | 'credit_card' | 'bank' | null;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';
  processingStep: string | null;
  extractionConfidence: number | null;
  extractedData: unknown | null;
  errorMessage: string | null;
  processedAt: Date | null;
  createdAt: Date;
}

export interface PortfolioSnapshot {
  id: number;
  accountId: number;
  pdfId: number | null;
  statementDate: Date;
  totalValue: number | null;
  cashBalance: number | null;
  investedValue: number | null;
  diversityScore: number | null;
  createdAt: Date;
}

export interface Holding {
  id: number;
  snapshotId: number;
  symbol: string;
  name: string | null;
  assetClass: string | null;
  sector: string | null;
  geography: string | null;
  quantity: number | null;
  price: number | null;
  marketValue: number | null;
  costBasis: number | null;
  unrealizedPnl: number | null;
  weightPct: number | null;
  isManualCorrection: boolean;
  createdAt: Date;
}

export interface Transaction {
  id: number;
  accountId: number;
  pdfId: number | null;
  date: Date;
  merchant: string | null;
  category: string | null;
  amount: number;
  isRecurring: boolean;
  recurringFrequency: string | null;
  statementDate: Date | null;
  isManualCorrection: boolean;
  createdAt: Date;
}

export interface AISuggestion {
  id: number;
  lifeStageProfileId: number | null;
  suggestionType: string | null;
  actionJson: unknown | null;
  reasoningText: string | null;
  reasoningJson: unknown | null;
  confidenceScore: number | null;
  priority: 'high' | 'medium' | 'low' | null;
  portfolioContext: unknown | null;
  userFeedback: 'accept' | 'reject' | 'snooze' | 'done' | null;
  userNote: string | null;
  isActive: boolean;
  createdAt: Date;
}
```

---

## 5. Relationships Summary

| Parent | Child | Type | On Delete |
|--------|-------|------|-----------|
| users | accounts | 1:N | CASCADE |
| users | life_stage_profiles | 1:N | CASCADE |
| institutions | accounts | 1:N | RESTRICT |
| accounts | pdfs | 1:N | SET NULL |
| accounts | portfolio_snapshots | 1:N | CASCADE |
| accounts | account_balances | 1:N | CASCADE |
| accounts | transactions | 1:N | CASCADE |
| pdfs | extraction_jobs | 1:N | CASCADE |
| pdfs | manual_corrections | 1:N | CASCADE |
| pdfs | portfolio_snapshots | 1:1 | SET NULL |
| pdfs | account_balances | 1:N | — |
| portfolio_snapshots | holdings | 1:N | CASCADE |
| life_stage_profiles | ai_suggestions | 1:N | SET NULL |

---

## 6. Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| users | (implicit) | email | Login lookup |
| accounts | uix_account_user_institution_name | user_id, institution_id, name | Prevent duplicate accounts |
| pdfs | idx_pdfs_status | account_id, extraction_status | Dashboard status queries |
| portfolio_snapshots | uix_snapshot_account_date | account_id, statement_date | Deduplicate monthly snapshots |
| portfolio_snapshots | idx_snapshots_account | account_id, statement_date DESC | Historical queries |
| holdings | uix_holding_snapshot_symbol | snapshot_id, symbol | Prevent duplicate positions |
| holdings | idx_holdings_snapshot | snapshot_id | Snapshot detail query |
| holdings | idx_holdings_symbol | symbol | Cross-account symbol analysis |
| transactions | idx_transactions_account | account_id, date DESC | Account history |
| transactions | idx_transactions_date | date DESC | Time-range queries |
| transactions | idx_transactions_category | category | Spending analysis |
| ai_suggestions | idx_suggestions_active | is_active, created_at DESC | Active suggestions inbox |
| ai_suggestions | idx_suggestions_profile | life_stage_profile_id | Profile-scoped queries |
| monthly_reports | uix_report_year_month | year, month | Prevent duplicate reports |
| monthly_reports | idx_reports_year_month | year, month DESC | Report archive |
| account_balances | uix_balance_account_date | account_id, statement_date | Deduplicate balances |
| extraction_jobs | idx_extraction_jobs_pdf | pdf_id | Job lookup per PDF |
| extraction_jobs | idx_extraction_jobs_status | status | Queue polling |

---

## 7. Data Flow

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
                                       │  Kimi API call  │
                                       │  (background)   │
                                       └─────────────────┘
                                                │
                       ┌────────────────────────┼────────────────────────┐
                       │                        │                        │
                       ▼                        ▼                        ▼
                ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
                │  brokerage  │         │ credit_card │         │    bank     │
                │  snapshot   │         │ transactions│         │   balance   │
                │ + holdings  │         │             │         │             │
                └─────────────┘         └─────────────┘         └─────────────┘
```
