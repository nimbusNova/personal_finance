# ERD: No-Auth Local-First Setup

> **Corresponds to:** [PRD: No-Auth Local-First Setup](../PRDs/PRD-No-Auth-Local-First-Setup.md)  
> **Last updated:** 2026-04-19  
> **Auth model:** None. Single-user local app. No `users` table. Settings (user name + API key) live in `api/data/settings.json`.

---

## What Changed From Previous Schema

### Deleted

| Object | Type | Reason |
|--------|------|--------|
| `users` | Table | Auth is removed entirely |
| `accounts.user_id` | Column + FK | No user concept |
| `life_stage_profiles.user_id` | Column + FK | No user concept |
| `uix_account_user_institution_name` | Unique Constraint | Included `user_id` |

### Modified

| Object | Old | New |
|--------|-----|-----|
| `accounts` unique constraint | `(user_id, institution_id, name)` | `(institution_id, name)` |
| `accounts` | `user_id INTEGER NOT NULL` | column removed |
| `life_stage_profiles` | `user_id INTEGER NOT NULL` | column removed |

### Unchanged

All other tables (`institutions`, `pdfs`, `portfolio_snapshots`, `holdings`, `transactions`, `account_balances`, `ai_suggestions`, `monthly_reports`, `extraction_jobs`, `manual_corrections`) remain exactly as before.

---

## Migration SQL (SQLite)

Run these in order. Because SQLite has limited `ALTER TABLE`, we recreate tables that need column drops.

```sql
-- ============================================
-- 1. Drop users table (must drop FKs first)
-- ============================================
-- SQLite does not enforce FK checks by default, but be safe:
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS users;

-- ============================================
-- 2. Recreate accounts without user_id
-- ============================================
CREATE TABLE accounts_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT,
    account_number_masked TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id),
    UNIQUE (institution_id, name)
);

INSERT INTO accounts_new (id, institution_id, name, account_type, account_number_masked, is_active, created_at)
SELECT id, institution_id, name, account_type, account_number_masked, is_active, created_at
FROM accounts;

DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;

-- ============================================
-- 3. Recreate life_stage_profiles without user_id
-- ============================================
CREATE TABLE life_stage_profiles_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    age INTEGER,
    annual_income NUMERIC(12, 2),
    risk_tolerance INTEGER,
    time_horizon_years INTEGER,
    goals_json TEXT,
    target_allocation_json TEXT,
    manifesto_text TEXT,
    is_active BOOLEAN DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO life_stage_profiles_new (id, age, annual_income, risk_tolerance, time_horizon_years, goals_json, target_allocation_json, manifesto_text, is_active, version, created_at)
SELECT id, age, annual_income, risk_tolerance, time_horizon_years, goals_json, target_allocation_json, manifesto_text, is_active, version, created_at
FROM life_stage_profiles;

DROP TABLE life_stage_profiles;
ALTER TABLE life_stage_profiles_new RENAME TO life_stage_profiles;

PRAGMA foreign_keys = ON;
```

---

## Code Changes Required

### Backend

| File | Action | Detail |
|------|--------|--------|
| `api/app/database/models.py` | Delete class | Remove `User` model entirely |
| `api/app/database/models.py` | Edit `Account` | Remove `user_id` column, `user` relationship, update `__table_args__` |
| `api/app/database/models.py` | Edit `LifeStageProfile` | Remove `user_id` column, `user` relationship |
| `api/app/routers/auth.py` | Delete file | Entire router is obsolete |
| `api/app/main.py` | Unregister router | Remove `auth` router from app |
| `api/app/routers/*.py` | Remove dependency | Delete `get_current_user` imports and `Depends()` usage in upload, holdings, transactions, accounts, suggestions routers |
| `api/app/routers/*.py` | Remove user filter | Delete any `.filter_by(user_id=...)` or `.filter(Model.user_id == ...)` query clauses |
| `api/app/services/kimi_service.py` | Change key source | Replace `settings.kimi_api_key` with call to new `settings_service.get_kimi_api_key()` |
| `api/app/services/settings_service.py` | Create file | Read/write `api/data/settings.json` |
| `api/app/routers/settings.py` | Create file | `GET /settings`, `POST /settings`, `POST /settings/test-key` |
| `api/tests/test_api.py` | Delete auth tests | Remove login/register/auth-status test cases |
| `api/tests/test_e2e.py` | Delete auth steps | Remove login/register from E2E test flows |
| `api/tests/conftest.py` | Remove User fixture | Delete `sample_user` or user-related fixtures if any |

### Frontend

| File | Action | Detail |
|------|--------|--------|
| `web/app/login/page.tsx` | Delete file | Login page no longer exists |
| `web/app/context/AuthContext.tsx` | Delete file | Auth context no longer exists |
| `web/app/layout.tsx` | Remove wrapper | Delete `<AuthProvider>` from root layout |
| `web/lib/api.ts` | Simplify | Remove `getToken()`, `Authorization` header, 401 redirect logic |
| `web/app/components/Navbar.tsx` | Edit | Remove Login/Logout; add Settings link; show user name from settings API |
| `web/app/dashboard/page.tsx` | Edit | Add "no API key configured" banner when key is missing |
| `web/app/upload/page.tsx` | Edit | Remove auth checks; uploads always allowed |
| `web/app/welcome/page.tsx` | Create file | First-run screen asking for name + API key |
| `web/app/settings/page.tsx` | Create file | Form to edit name + API key |
| `web/app/components/APIKeyInput.tsx` | Create file | Reusable input with test/save logic |

---

## Full Schema Diagram

```
institutions
├── id PK
├── name
├── type              -- brokerage | bank | credit_card
├── logo_url
└── created_at
        │
        │ 1:N
        ▼
accounts
├── id PK
├── institution_id FK ──────► institutions.id
├── name
├── account_type      -- 401k | IRA | taxable | checking | savings
├── account_number_masked
├── is_active
└── created_at
        │
        │ 1:N
        ├─────────────────────► pdfs
        │ 1:N
        ├─────────────────────► portfolio_snapshots
        │ 1:N
        ├─────────────────────► account_balances
        │ 1:N
        └─────────────────────► transactions

pdfs
├── id PK
├── account_id FK ──────────► accounts.id
├── original_filename
├── file_path
├── file_size
├── page_count
├── doc_type          -- brokerage | credit_card | bank
├── extraction_status -- pending | processing | completed | failed | manual_review
├── processing_step
├── extraction_confidence
├── extracted_data    -- JSON (raw Kimi output)
├── error_message
├── processed_at
└── created_at
        │
        │ 1:1
        ├─────────────────────► portfolio_snapshots
        │ 1:N
        ├─────────────────────► transactions
        │ 1:N
        ├─────────────────────► manual_corrections
        │ 1:N
        └─────────────────────► extraction_jobs

portfolio_snapshots
├── id PK
├── account_id FK ──────────► accounts.id
├── pdf_id FK UQ ───────────► pdfs.id
├── statement_date
├── total_value
├── cash_balance
├── invested_value
├── diversity_score
└── created_at
        │
        │ 1:N
        ▼
holdings
├── id PK
├── snapshot_id FK ─────────► portfolio_snapshots.id
├── symbol              UQ(with snapshot_id)
├── name
├── asset_class       -- equity | bond | commodity | cash_equivalent | alternative
├── sector
├── geography         -- US | international | emerging
├── quantity
├── price
├── market_value
├── cost_basis
├── unrealized_pnl
├── weight_pct
├── is_manual_correction
└── created_at

account_balances
├── id PK
├── account_id FK ──────────► accounts.id      UQ(with statement_date)
├── pdf_id FK ──────────────► pdfs.id
├── statement_date
├── balance
├── currency          -- default 'USD'
└── created_at

transactions
├── id PK
├── account_id FK ──────────► accounts.id
├── pdf_id FK ──────────────► pdfs.id
├── date
├── merchant
├── category
├── amount
├── is_recurring
├── recurring_frequency   -- monthly | yearly
├── statement_date
├── is_manual_correction
└── created_at

life_stage_profiles
├── id PK
├── age
├── annual_income
├── risk_tolerance    -- 1-10
├── time_horizon_years
├── goals_json        -- JSON ["retirement", "house", ...]
├── target_allocation_json
├── manifesto_text
├── is_active
├── version
└── created_at
        │
        │ 1:N
        ▼
ai_suggestions
├── id PK
├── life_stage_profile_id FK ► life_stage_profiles.id
├── suggestion_type   -- rebalance | buy | sell | diversify | spending
├── action_json
├── reasoning_text
├── reasoning_json
├── confidence_score  -- 0.0-1.0
├── priority          -- high | medium | low
├── portfolio_context -- JSON snapshot
├── user_feedback     -- accept | reject | snooze | done
├── user_note
├── is_active
└── created_at

monthly_reports
├── id PK
├── year
├── month
├── generated_at
├── summary_text
├── metrics_json
├── suggestions_count
├── status            -- pending | generating | completed | failed
├── error_message
└── created_at

extraction_jobs
├── id PK
├── pdf_id FK ──────────────► pdfs.id
├── job_type          -- extraction | reprocessing
├── status            -- pending | running | completed | failed
├── attempts
├── error_details     -- JSON
├── started_at
├── completed_at
└── created_at

manual_corrections
├── id PK
├── pdf_id FK ──────────────► pdfs.id
├── field_name        -- e.g. "holdings.VTI.quantity"
├── original_value
├── corrected_value
├── corrected_by      -- default 'user'
├── correction_note
└── created_at
```

---

## Full Schema (SQLite DDL)

```sql
CREATE TABLE institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    logo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    account_type TEXT,
    account_number_masked TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (institution_id) REFERENCES institutions(id),
    UNIQUE (institution_id, name)
);

CREATE TABLE life_stage_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    age INTEGER,
    annual_income NUMERIC(12, 2),
    risk_tolerance INTEGER,
    time_horizon_years INTEGER,
    goals_json TEXT,
    target_allocation_json TEXT,
    manifesto_text TEXT,
    is_active BOOLEAN DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER,
    original_filename TEXT,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    page_count INTEGER,
    doc_type TEXT,
    extraction_status TEXT DEFAULT 'pending',
    processing_step TEXT,
    extraction_confidence REAL,
    extracted_data TEXT,
    error_message TEXT,
    processed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE TABLE extraction_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    error_details TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
);

CREATE TABLE manual_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL,
    field_name TEXT NOT NULL,
    original_value TEXT,
    corrected_value TEXT,
    corrected_by TEXT DEFAULT 'user',
    correction_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
);

CREATE TABLE account_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    pdf_id INTEGER,
    statement_date DATETIME,
    balance NUMERIC(15, 2),
    currency TEXT DEFAULT 'USD',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id),
    UNIQUE (account_id, statement_date)
);

CREATE TABLE portfolio_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    pdf_id INTEGER UNIQUE,
    statement_date DATETIME NOT NULL,
    total_value NUMERIC(15, 2),
    cash_balance NUMERIC(15, 2),
    invested_value NUMERIC(15, 2),
    diversity_score REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id),
    UNIQUE (account_id, statement_date)
);

CREATE TABLE holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL,
    symbol TEXT NOT NULL,
    name TEXT,
    asset_class TEXT,
    sector TEXT,
    geography TEXT,
    quantity NUMERIC(15, 6),
    price NUMERIC(12, 4),
    market_value NUMERIC(15, 2),
    cost_basis NUMERIC(15, 2),
    unrealized_pnl NUMERIC(15, 2),
    weight_pct REAL,
    is_manual_correction BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (snapshot_id) REFERENCES portfolio_snapshots(id),
    UNIQUE (snapshot_id, symbol)
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    pdf_id INTEGER,
    date DATETIME NOT NULL,
    merchant TEXT,
    category TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    is_recurring BOOLEAN DEFAULT 0,
    recurring_frequency TEXT,
    statement_date DATETIME,
    is_manual_correction BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
);

CREATE TABLE ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    life_stage_profile_id INTEGER,
    suggestion_type TEXT,
    action_json TEXT,
    reasoning_text TEXT,
    reasoning_json TEXT,
    confidence_score REAL,
    priority TEXT,
    portfolio_context TEXT,
    user_feedback TEXT,
    user_note TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (life_stage_profile_id) REFERENCES life_stage_profiles(id)
);

CREATE TABLE monthly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    generated_at DATETIME,
    summary_text TEXT,
    metrics_json TEXT,
    suggestions_count INTEGER,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Changelog

### 2026-04-19 (v3.0 — No-Auth)
- **Deleted:** `users` table
- **Deleted:** `user_id` column from `accounts`
- **Deleted:** `user_id` column from `life_stage_profiles`
- **Modified:** `accounts` unique constraint changed from `(user_id, institution_id, name)` to `(institution_id, name)`
- **Note:** App settings (user name + API key) now live in `api/data/settings.json`, not in the database.
