# Personal Finance Portfolio Intelligence - ERD

## Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENTITY RELATIONSHIP DIAGRAM                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   institutions   │         │      users       │         │ life_stage_profiles│
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │         │ id (PK)          │
│ name             │         │ email            │         │ user_id (FK)     │
│ type             │         │ password_hash    │         │ age              │
│ logo_url         │         │ created_at       │         │ annual_income    │
│ created_at       │         │ updated_at       │         │ risk_tolerance   │
└────────┬─────────┘         └────────┬─────────┘         │ time_horizon     │
         │                              │                   │ goals_json       │
         │                              │                   │ target_allocation│
         │                              │                   │ manifesto_text   │
         │                              │                   │ is_active        │
         │                              │                   │ version          │
         │                              │                   │ created_at       │
         │                              │                   └────────┬─────────┘
         │                              │                            │
         │                              └────────────┬───────────────┘
         │                                           │
         │         ┌──────────────────┐                │
         │         │    accounts      │                │
         │         ├──────────────────┤                │
         └────────►│ id (PK)          │◄───────────────┘
                   │ user_id (FK)     │                │
                   │ institution_id   │                │
                   │ name             │                │
                   │ account_type     │                │
                   │ account_number   │                │
                   │ is_active        │                │
                   │ created_at       │                │
                   └────────┬─────────┘                │
                            │                          │
                            │                          │
         ┌────────────────────┼────────────────────┐   │
         │                    │                    │   │
         ▼                    ▼                    ▼   │
┌──────────────────┐  ┌──────────────────┐  ┌──────────┴───┐
│     pdfs         │  │portfolio_snapshots│  │  transactions  │
├──────────────────┤  ├──────────────────┤  ├────────────────┤
│ id (PK)          │  │ id (PK)          │  │ id (PK)        │
│ account_id (FK)  │  │ account_id (FK)  │  │ account_id (FK)│
│ file_path        │  │ pdf_id (FK)      │  │ pdf_id (FK)    │
│ file_size        │  │ statement_date   │  │ date           │
│ page_count       │  │ total_value      │  │ merchant       │
│ extraction_status│  │ cash_balance     │  │ category       │
│ extraction_conf  │  │ invested_value   │  │ amount         │
│ extracted_data   │  │ diversity_score  │  │ is_recurring   │
│ error_message    │  │ created_at       │  │ recurring_freq │
│ processed_at     │  └────────┬─────────┘  │ statement_date │
│ created_at       │           │             │ created_at     │
└────────┬─────────┘           │             └────────────────┘
         │                     │
         │         ┌───────────┴───────────┐
         │         │       holdings        │
         │         ├───────────────────────┤
         │         │ id (PK)               │
         │         │ snapshot_id (FK)      │
         │         │ symbol                │
         │         │ name                  │
         │         │ asset_class           │
         │         │ sector                │
         │         │ geography             │
         │         │ quantity              │
         │         │ price                 │
         │         │ market_value          │
         │         │ cost_basis              │
         │         │ unrealized_pnl        │
         │         │ weight_pct            │
         │         │ is_manual_correction  │
         │         │ created_at            │
         │         └───────────────────────┘
         │
         │         ┌──────────────────┐
         │         │  manual_corrections│
         │         ├──────────────────┤
         │         │ id (PK)          │
         │         │ pdf_id (FK)      │
         │         │ field_name       │
         │         │ original_value   │
         │         │ corrected_value  │
         │         │ corrected_by     │
         │         │ correction_note  │
         │         │ created_at       │
         │         └──────────────────┘
         │
         ▼
┌──────────────────┐         ┌──────────────────┐
│  extraction_jobs │         │   ai_suggestions │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │
│ pdf_id (FK)      │         │ life_stage_id(FK)│
│ job_type         │         │ suggestion_type  │
│ status           │◄────────│ action_json      │
│ attempts         │         │ reasoning_text   │
│ error_details    │         │ reasoning_json   │
│ started_at       │         │ confidence_score │
│ completed_at     │         │ priority         │
│ created_at       │         │ portfolio_context│
└──────────────────┘         │ user_feedback    │
                             │ user_note        │
                             │ is_active        │
                             │ created_at       │
                             └────────┬─────────┘
                                      │
                                      ▼
                             ┌──────────────────┐
                             │  monthly_reports │
                             ├──────────────────┤
                             │ id (PK)          │
                             │ year             │
                             │ month            │
                             │ generated_at     │
                             │ summary_text     │
                             │ metrics_json     │
                             │ suggestions_count│
                             │ status           │
                             │ error_message    │
                             │ created_at       │
                             └──────────────────┘
```

## Entity Details

### users
Single-user table (can extend to multi-tenant later)

### life_stage_profiles (Versioned)
Track changes to user profile over time. `is_active` marks current version.

### institutions
Master list of financial institutions (Chase, Schwab, Fidelity, etc.)

### accounts
Individual accounts within institutions (401k, Taxable, Checking, etc.)

### pdfs
Raw PDF storage metadata + extraction results
- `extraction_status`: pending | processing | completed | failed | manual_review
- `extraction_conf`: 0-1 confidence score from Kimi
- `extracted_data`: Raw JSON from Kimi (before normalization)

### manual_corrections
Track when user fixes extraction errors
- Enables learning/improving prompts over time
- Audit trail for data quality

### portfolio_snapshots
Point-in-time account state from brokerage statements
- One per PDF for brokerage statements
- Links to holdings

### holdings
Individual positions within a snapshot
- `is_manual_correction`: User edited this holding manually

### transactions
Spending transactions from credit card/bank statements

### extraction_jobs
Background job tracking for Kimi API calls
- Retry logic for failures
- Audit trail for processing

### ai_suggestions
Investment and spending recommendations
- `portfolio_context`: Snapshot of holdings when suggestion made
- `user_feedback`: accept | reject | snooze | done

### monthly_reports
Cached/generated monthly summaries

## Key Relationships

1. **User → Life Stage Profiles** (1:M) - Versioned profile history
2. **User → Accounts** (1:M) - User has multiple accounts
3. **Account → PDFs** (1:M) - Account has multiple statements
4. **PDF → Portfolio Snapshot** (1:1) - Brokerage PDF = one snapshot
5. **PDF → Transactions** (1:M) - Credit card PDF = many transactions
6. **Snapshot → Holdings** (1:M) - Snapshot contains multiple holdings
7. **PDF → Manual Corrections** (1:M) - Track all user fixes
8. **Life Stage → Suggestions** (1:M) - Suggestions tied to profile version

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_pdfs_account_status ON pdfs(account_id, extraction_status);
CREATE INDEX idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, date DESC);
CREATE INDEX idx_suggestions_active ON ai_suggestions(is_active, created_at DESC);
CREATE INDEX idx_corrections_pdf ON manual_corrections(pdf_id);
```