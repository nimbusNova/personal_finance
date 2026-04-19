# PRD: Personal Finance — Portfolio Intelligence & Monthly Report

**Version:** 1.1  
**Date:** 2026-04-17  
**Status:** Draft  
**Author:** AI-assisted / User-defined

> **Implementation Note (Phase 1):** The actual Phase 1 implementation diverges from this PRD's original architecture. The current codebase uses **SQLite** (local file) instead of Supabase PostgreSQL, and **local filesystem** instead of Supabase Storage. The PRD is preserved as the original product specification. See `README.md` and `docs/IMPLEMENTATION_PLAN.md` for the implemented stack.  

---

## 1. Vision & Objective

Build a personal, read-only portfolio intelligence platform that aggregates holdings across all financial accounts, evaluates portfolio diversity and concentration risk, and delivers AI-powered suggestions with detailed reasoning. The system learns the user's life stage, maintains a complete audit trail of recommendations and decisions, and generates a rich monthly dashboard report.

**Approach:** PDF-first data ingestion. Kimi (Moonshot AI) parses all uploaded PDF statements into structured JSON. API sync is a Phase II automation layer on top of the PDF foundation.

---

## 2. Target User

Single user (you). No multi-tenancy, no social features, no payment walls. Personal finance tool optimized for long-term wealth building with transparent, explainable AI guidance.

---

## 3. Core Value Propositions

1. **Unified Net Worth View** — See all holdings normalized across brokers in one dashboard.
2. **Diversity & Risk Intelligence** — Understand concentration risk by asset class, sector, geography, and individual position.
3. **Explainable Suggestions** — Every recommendation includes detailed reasoning (market context, life-stage fit, tax implications, historical precedent).
4. **Life-Stage Adaptive AI** — The recommendation model adjusts as you age, change income, or shift goals.
5. **Decision Trail** — A persistent record of what the AI suggested, why, and what you decided.
6. **Beautiful Monthly Report** — A Vercel-hosted interactive dashboard summarizing the month's changes, AI insights, and forward outlook.

---

# Part I: Phase I — Personal Usage

## I.1 Scope

**Goal:** A tool that works for you, deployed privately. Completely PDF-based — no API connections required.

- Upload **brokerage statements** (any broker) → extract holdings, cost basis, transactions
- Upload **credit card statements** (Chase, etc.) → extract transactions, categories, merchants
- Upload **bank statements** → extract cash flows, deposits, withdrawals
- Kimi auto-detects document type and returns structured JSON
- Investment suggestions with detailed reasoning
- Spending analysis (expensive items, recurring charge optimization)
- Monthly dashboard reports
- Decision trail + life-stage wizard
- JSON/CSV/PDF export
- PWA for mobile access

**Success Criteria:** You use it weekly. It accurately reflects your portfolio and spending. Suggestions are useful. Spending insights reveal patterns you didn't notice.

---

## I.2 Functional Requirements

### I.2.1 Account Aggregation (PDF-Only)

| ID | Requirement | Priority |
|----|-------------|----------|
| F1.1 | **PDF Statement Upload** — Drag-and-drop upload of brokerage, credit card, and bank statements. Kimi auto-detects document type and extracts structured data. | P0 |
| F1.2 | **Batch Upload** — Upload multiple PDFs at once (e.g., 12 months of statements) with per-file progress tracking. | P0 |
| F1.3 | **Document Type Detection** — Kimi identifies whether a PDF is a brokerage statement, credit card statement, or bank statement before extraction. | P0 |
| F1.4 | **Future Extensibility** — Schema designed so new institutions (Vanguard, Fidelity, Chase, PNC) require only a new Kimi prompt template, not code changes. | P1 |
| F1.5 | **Data Normalization** — Map extracted tickers to canonical identifiers. Resolve ETFs/funds to asset classes, sectors, and geographies. Normalize merchant names and spending categories across institutions. | P0 |

### I.2.2 Portfolio Analytics

| ID | Requirement | Priority |
|----|-------------|----------|
| F2.1 | **Unified Dashboard** — Total AUM across all linked accounts. Breakdown by institution, account type (taxable, retirement, cash). | P0 |
| F2.2 | **Performance Metrics** — Total return, unrealized/realized P&L, IRR vs. benchmarks (S&P 500). | P0 |
| F2.3 | **Allocation Analysis** — Current allocation across asset class, sector, geography, market cap, and individual position concentration. **Diversity model:** Concentration-risk flags only. | P0 |
| F2.4 | **Diversity Scoring** — Composite score (0-100) based on concentration risk. | P1 |
| F2.5 | **Historical Tracking** — Time-series charts of net worth, allocation drift, and performance (1M, 3M, 1Y, 3Y, All). | P1 |

### I.2.3 Spending Analysis

| ID | Requirement | Priority |
|----|-------------|----------|
| F2.6 | **Spending Aggregation** — Aggregate credit card / bank transactions by category, merchant, and time period. Detect MoM trends and top categories. | P0 |
| F2.7 | **Flag Expensive Items** — Surface transactions above a configurable threshold (default: $200) or significantly above typical spend for that merchant/category. | P0 |
| F2.8 | **Recurring / Optimization Detection** — Identify subscriptions, memberships, recurring bills. Flag duplicates, price increases, and forgotten charges. Suggest optimizations. | P0 |

### I.2.4 AI Suggestion Engine (Kimi)

| ID | Requirement | Priority |
|----|-------------|----------|
| F3.1 | **Investment Suggestions** — Actionable portfolio recommendations with specific buy/sell actions. | P0 |
| F3.2 | **Detailed Reasoning** — Every suggestion includes: What, Why, Context, Impact, Trade-offs. | P0 |
| F3.3 | **Life-Stage Adaptation** — Onboarding wizard collects profile. AI auto-generates initial glide path. User can inspect, override, and refine with AI-guided change tracking. All revisions versioned. | P0 |
| F3.4 | **Spending Insights** — AI observations on spending patterns: expensive item alerts, recurring charge optimization, category trends. | P1 |
| F3.5 | **Kimi PDF Analysis** — Kimi extracts holdings from PDFs, identifies discrepancies with prior data, flags anomalies. | P1 |
| F3.6 | **Kimi Report Narrative** — AI-generated monthly executive summary and forward outlook. | P1 |
| F3.7 | **Structured Output** — All AI suggestions returned as structured JSON (action, reasoning, confidence, priority) for consistent UI rendering. | P0 |

### I.2.5 Decision Trail & Feedback

| ID | Requirement | Priority |
|----|-------------|----------|
| F4.1 | **Suggestion Logging** — Every suggestion persisted with timestamp, life-stage context, portfolio snapshot, full reasoning, model version. | P0 |
| F4.2 | **User Feedback** — Mark suggestions as Accept, Reject, Snooze, or Done. Optional note field. | P1 |
| F4.3 | **Trail Timeline** — Chronological view of all suggestions, decisions, and outcomes. Filter by status, asset, date. | P1 |
| F4.4 | **Personal Manifesto** — Free-text investing rules that AI references before generating suggestions. | P1 |

### I.2.6 Monthly Report & Dashboard

| ID | Requirement | Priority |
|----|-------------|----------|
| F5.1 | **Vercel-Hosted Dashboard** — Next.js 14 app. Responsive to 375px. System-adaptive dark mode. | P0 |
| F5.2 | **Monthly Report** — Auto-generated on the 1st (or manual trigger). Includes: executive summary, net worth change, allocation drift, top gainers/losers, diversity score, active suggestions, spending summary, forward outlook. | P0 |
| F5.3 | **Interactive Charts** — Tremor + Recharts for portfolio composition, performance, allocation drift. | P1 |
| F5.4 | **Report Archive** — All past reports accessible via date picker. | P1 |
| F5.5 | **Advisor Export** — Download monthly report as formatted PDF to share with CPA/advisor. | P1 |

---

## I.3 Architecture

### I.3.1 Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS | Best-in-class for SSR. |
| **UI Components** | Tremor + Recharts | Analytics components + charting. |
| **API** | FastAPI | Python-native. Handles Kimi orchestration + PDF pipeline cleanly. |
| **Database + Storage** | **SQLite + Local filesystem** *(Phase 1)* / **Supabase** *(Phase 2, planned)* | Phase 1: SQLite for relational data + local filesystem for PDFs. Phase 2: may migrate to PostgreSQL + cloud storage. |
| **AI** | Kimi API (Moonshot AI) | Long context (200K+), file upload API, vision models for scanned PDFs, structured JSON output. |
| **Auth** | Simple password + biometric on mobile (WebAuthn / device biometrics via PWA) | Single-user tool. |
| **Scheduling** | GitHub Actions cron | Free, triggers FastAPI endpoints for monthly report generation. |

### I.3.2 Phase I Data Flow (Implemented)

```
User uploads PDF → Local filesystem (data/pdfs/)
        │
        ▼
FastAPI worker reads PDF → calls Kimi API
        │
        ▼
Kimi returns structured JSON (holdings OR transactions)
        │
        ▼
Post-processing: normalize tickers, validate totals,
flag low-confidence extractions
        │
        ▼
Store in SQLite (data/personal_finance.db)
        │
        ▼
Next.js dashboard reads from DB → renders charts + suggestions
```

### I.3.3 PDF Ingestion Pipeline (Kimi-Native)

**No OCR libraries. No PyMuPDF. No Tesseract.** Kimi handles everything.

1. **Upload** — User drags PDFs to Next.js UI → stored in local filesystem (`data/pdfs/`)
2. **Extract** — FastAPI reads PDF file and sends to Kimi API with prompt:
   ```
   "Analyze this financial statement. Identify if it is a 
   brokerage statement, credit card statement, or bank statement. 
   Extract all relevant data as structured JSON. Include confidence 
   scores for each extracted field."
   ```
3. **Validate** — FastAPI checks: sum of holdings ≈ total value, no negative quantities, dates within statement period
4. **Review** — UI shows extracted JSON side-by-side with PDF for user confirmation
5. **Store** — Confirmed data written to SQLite

### I.3.4 Kimi Extraction Schemas

Kimi returns one of two schemas depending on document type:

**Brokerage Statement:**
```json
{
  "doc_type": "brokerage",
  "institution": "Charles Schwab",
  "account_type": "Individual Taxable",
  "statement_date": "2026-03-31",
  "holdings": [{ "symbol": "VTI", "quantity": 150.5, "price": 280.42, "market_value": 42203.21 }],
  "cash": { "settled_cash": 5000.00 },
  "extraction_confidence": 0.94
}
```

**Credit Card Statement:**
```json
{
  "doc_type": "credit_card",
  "institution": "Chase",
  "account_name": "Chase Sapphire Preferred",
  "statement_date": "2026-03-31",
  "statement_balance": 3250.00,
  "transactions": [
    { "date": "2026-03-12", "merchant": "Whole Foods", "category": "Groceries", "amount": 142.35, "is_recurring": false },
    { "date": "2026-03-15", "merchant": "Netflix", "category": "Entertainment", "amount": 15.49, "is_recurring": true }
  ],
  "extraction_confidence": 0.91
}
```

---

## I.4 Data Model

```sql
-- Life-stage profile (versioned)
life_stage_profiles (
  id, user_id, created_at,
  age, annual_income, risk_tolerance, time_horizon_years,
  goals_json, target_allocation_json, manifesto_text
);

-- Portfolio snapshots (from brokerage PDFs)
portfolio_snapshots (
  id, date, institution, account_type,
  total_value, cash_balance, invested_value,
  diversity_score
);

-- Holdings
holdings (
  id, snapshot_id, symbol, name, asset_class, sector, geography,
  quantity, market_value, cost_basis, unrealized_pnl, weight_pct
);

-- Spending transactions (from credit card / bank PDFs)
transactions (
  id, date, institution, account_name, merchant, category,
  amount, is_recurring, recurring_frequency, statement_date
);

-- AI suggestions with reasoning
decision_trail (
  id, created_at, life_stage_profile_id,
  suggestion_type, action_json, reasoning_text, reasoning_json,
  confidence_score, priority, user_feedback, user_note
);

-- Monthly reports
monthly_reports (
  id, year, month, generated_at,
  summary_text, metrics_json, dashboard_url
);
```

---

## I.5 User Flows

### Monthly Report Flow
```
1st of month → Worker aggregates last 30 days of snapshots + transactions →
Compute MoM changes → Call Kimi for narrative + suggestions →
Generate report → Update dashboard
```

### Suggestion Review Flow
```
User opens Dashboard → Sees "Suggestions Inbox" →
Reads detailed reasoning card → Clicks Accept / Reject / Snooze →
Feedback recorded → Future suggestions reference this feedback
```

### Historical Backfill Flow
```
User uploads 12 PDFs → Kimi extracts each →
System processes chronologically → Detects holding changes between statements →
Immediate time-series charts
```

---

## I.6 Phase I Milestones

| Milestone | Deliverable | ETA |
|-----------|-------------|-----|
| M1 | Vercel dashboard scaffold + Supabase schema + Auth | Week 1 |
| M2 | Kimi PDF ingestion pipeline (brokerage + credit card + bank) | Week 2 |
| M3 | Historical backfill — batch upload + chronological processing | Week 2-3 |
| M4 | Holdings normalization + diversity analytics + charts | Week 3-4 |
| M5 | Spending analysis (categorization + expensive items + recurring detection) | Week 4-5 |
| M6 | Kimi investment + spending suggestion engine + reasoning display | Week 5-6 |
| M7 | Decision trail + life-stage profile wizard | Week 6-7 |
| M8 | Monthly report generation + PDF export for advisors | Week 7-8 |
| M9 | Dark mode + PWA + mobile responsiveness | Week 8 |

---

# Part II: Phase II — Publishable Product + Automated Import

## II.1 Scope

**Goal:** Add real-time API connections for convenience, and polish for public release.

- Automated broker sync (Robinhood, Schwab, others)
- API data cross-validates against PDF-extracted baseline
- Multi-tenant auth, public onboarding, subscription billing
- App Store / Play Store distribution

---

## II.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| F6.1 | **Robinhood API Sync** — Daily sync via `robin-stocks`. Pull positions, cost basis, cash, transactions. Cross-validate against last PDF. | P2 |
| F6.2 | **Charles Schwab API Sync** — Daily sync via official Trader API (OAuth2). Pull positions, balances, transactions. Cross-validate against last PDF. | P2 |
| F6.3 | **Divergence Alert** — If API data diverges from last PDF by >2%, flag for review. | P2 |
| F6.4 | **Graceful Degradation** — If API breaks, fall back to PDF-only mode silently. | P2 |
| F6.5 | **Multi-Tenant Auth** — Clerk or Auth0. Public signup flow. | P2 |
| F6.6 | **Broker OAuth Wizards** — Self-service connection for supported brokers. | P2 |
| F6.7 | **Subscription Billing** — Stripe integration for SaaS pricing. | P3 |
| F6.8 | **Capacitor Native Apps** — iOS / Android app store distribution. | P3 |

---

## II.3 Architecture Additions

```
Phase I Architecture
        +
        ├── Robinhood sync worker (robin-stocks)
        ├── Schwab sync worker (schwabpy + OAuth2)
        └── Cross-validation service (API vs. PDF baseline)
```

---

## II.4 Phase II Milestones

| Milestone | Deliverable | ETA |
|-----------|-------------|-----|
| M10 | Robinhood + Schwab automated API sync + cross-validation | TBD |
| M11 | Multi-tenant auth + public onboarding | TBD |
| M12 | Capacitor iOS/Android apps | TBD |

---

# Part III: Phase III — Advanced / Enterprise

## III.1 Scope

**Goal:** Power-user features, tax optimization, and institutional compatibility.

---

## III.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| F7.1 | **Tax Tracking** — Cost basis, tax lots, wash-sale flags across accounts. | P3 |
| F7.2 | **Family / Partner View** — Read-only shared visibility. | P3 |
| F7.3 | **Cash Flow Aggregation** — Bank account balance tracking for true net worth. | P3 |
| F7.4 | **OFX / QFX Export** — Quicken/QuickBooks compatibility. | P3 |
| F7.5 | **FDX API Support** — Enterprise data exchange standard. | P3 |
| F7.6 | **White-Label** — RIA/advisor client reporting. | P3 |
| F7.7 | **Decision Trail Backtesting** — Simulate outcomes of past accepted/rejected suggestions. | P3 |

---

# Shared Infrastructure

## Data Export Roadmap

| Phase | Formats | Purpose |
|-------|---------|---------|
| Phase I | JSON, CSV, PDF Report | Backup, Excel, advisor sharing |
| Phase II | Same as Phase I | No change needed for SaaS launch |
| Phase III | + OFX, QFX, FDX API | Quicken/QuickBooks, enterprise compatibility |

**Note:** OFX is the legacy XML standard. FDX API is the modern JSON replacement (Section 1033 compliant). For a personal tool, JSON/CSV covers all needs. Legacy formats are Phase III nice-to-haves.

---

## Mobile Deployment

| Phase | Approach | Effort |
|-------|----------|--------|
| Phase I | **PWA** — `next-pwa` plugin, responsive design, "Add to Home Screen" | 1 day |
| Phase II | **Capacitor** — Wrap Next.js static export into native iOS/Android apps | 2-3 days |

---

## Decisions Log

| Question | Decision |
|----------|----------|
| Life-Stage Model | Auto-generate from wizard; user inspects/overrides with AI-guided change tracking |
| Suggestion Authority | Purely advisory — no API trade execution |
| Notifications | Dashboard-only (badge + inbox) |
| Diversity Model | Concentration-risk flags only |
| Mobile | PWA primary; Capacitor optional in Phase II |
| Data Ingestion | **PDF-first, Kimi-native** — no OCR libraries |
| Storage | **Local filesystem** (Phase 1) — may migrate to cloud storage in Phase 2 |
| Data Export | JSON primary; OFX/QFX/FDX deferred to Phase III |
| Offline Mode | Not supported |
| Tax Tracking | Phase III |
| Family View | Phase III |
| Cash Flow | Phase III |
| Security | Biometric on mobile, password on web |
| Advisor Sharing | Yes, PDF export |
| Dark Mode | System-adaptive |
