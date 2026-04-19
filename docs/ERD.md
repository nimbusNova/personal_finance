# Personal Finance Portfolio Intelligence - ERD (SQLite Edition)

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
│ logo_path        │         │ created_at       │         │ annual_income    │
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
│ doc_type         │  │ cash_balance     │  │ category       │
│                  │  │ invested_value   │  │ amount         │
│ extraction_status│  │ diversity_score  │  │ is_recurring   │
│ extraction_conf  │  │ created_at       │  │ recurring_freq │
│ extracted_data   │  └────────┬─────────┘  │ statement_date │
│ error_message    │           │             │ created_at     │
│ processed_at     │           │             └────────────────┘
│ created_at       │           │
└────────┬─────────┘           │
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
         │         │ cost_basis            │
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

## SQLite Schema

```sql
-- SQLite schema for local self-hosted deployment
-- Run this to initialize the database

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Users table (single-user, but structured for future extension)
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Institutions master list
CREATE TABLE institutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('brokerage', 'bank', 'credit_card')),
    logo_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Accounts (linked to institutions)
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_id INTEGER NOT NULL REFERENCES institutions(id),
    name TEXT NOT NULL,
    account_type TEXT, -- 401k, IRA, taxable, checking, etc
    account_number_masked TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Life stage profiles (versioned)
CREATE TABLE life_stage_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    age INTEGER,
    annual_income REAL,
    risk_tolerance INTEGER CHECK(risk_tolerance BETWEEN 1 AND 10),
    time_horizon_years INTEGER,
    goals_json TEXT, -- JSON array: ["retirement", "house", "education"]
    target_allocation_json TEXT, -- JSON: {"us_equity": 60, "intl_equity": 20, ...}
    manifesto_text TEXT,
    is_active BOOLEAN DEFAULT 1,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PDFs table (metadata for local file storage)
CREATE TABLE pdfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    original_filename TEXT, -- Original uploaded filename (e.g., "schwab_statement_mar_2024.pdf")
    file_path TEXT NOT NULL, -- Local path: data/pdfs/2024/03/schwab_statement_mar_2024.pdf
    file_size INTEGER,
    page_count INTEGER,
    doc_type TEXT CHECK(doc_type IN ('brokerage', 'credit_card', 'bank')),
    
    -- Extraction status
    extraction_status TEXT DEFAULT 'pending' 
        CHECK(extraction_status IN ('pending', 'processing', 'completed', 'failed', 'manual_review')),
    extraction_confidence REAL,
    extracted_data TEXT, -- JSON string
    error_message TEXT,
    
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for status queries
CREATE INDEX idx_pdfs_status ON pdfs(account_id, extraction_status);

-- Extraction job tracking (for retry logic)
CREATE TABLE extraction_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK(job_type IN ('extraction', 'reprocessing')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    error_details TEXT, -- JSON
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_extraction_jobs_pdf ON extraction_jobs(pdf_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);

-- Manual corrections (track user fixes)
CREATE TABLE manual_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pdf_id INTEGER NOT NULL REFERENCES pdfs(id) ON DELETE CASCADE,
    field_name TEXT NOT NULL, -- e.g., "holdings.VTI.quantity"
    original_value TEXT,
    corrected_value TEXT,
    corrected_by TEXT DEFAULT 'user',
    correction_note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Portfolio snapshots (point-in-time account state)
CREATE TABLE portfolio_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pdf_id INTEGER UNIQUE REFERENCES pdfs(id) ON DELETE SET NULL,
    statement_date DATE NOT NULL,
    total_value REAL,
    cash_balance REAL,
    invested_value REAL,
    diversity_score REAL, -- 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_snapshots_account ON portfolio_snapshots(account_id, statement_date DESC);

-- Holdings (individual positions)
CREATE TABLE holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES portfolio_snapshots(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    name TEXT,
    asset_class TEXT, -- equity, bond, commodity, etc
    sector TEXT,
    geography TEXT, -- US, international, emerging, etc
    quantity REAL,
    price REAL,
    market_value REAL,
    cost_basis REAL,
    unrealized_pnl REAL,
    weight_pct REAL,
    is_manual_correction BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_holdings_snapshot ON holdings(snapshot_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);

-- Transactions (spending)
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    pdf_id INTEGER REFERENCES pdfs(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    merchant TEXT,
    category TEXT,
    amount REAL NOT NULL,
    is_recurring BOOLEAN DEFAULT 0,
    recurring_frequency TEXT, -- monthly, yearly, etc
    statement_date DATE,
    is_manual_correction BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_account ON transactions(account_id, date DESC);
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);

-- AI suggestions
CREATE TABLE ai_suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    life_stage_profile_id INTEGER REFERENCES life_stage_profiles(id) ON DELETE SET NULL,
    suggestion_type TEXT, -- rebalance, buy, sell, diversify, spending
    action_json TEXT, -- JSON: { "action": "Sell VTI", "amount": 5000 }
    reasoning_text TEXT,
    reasoning_json TEXT, -- Structured reasoning
    confidence_score REAL,
    priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
    portfolio_context TEXT, -- JSON snapshot
    user_feedback TEXT CHECK(user_feedback IN ('accept', 'reject', 'snooze', 'done')),
    user_note TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suggestions_active ON ai_suggestions(is_active, created_at DESC);
CREATE INDEX idx_suggestions_profile ON ai_suggestions(life_stage_profile_id);

-- Monthly reports
CREATE TABLE monthly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
    generated_at TIMESTAMP,
    summary_text TEXT,
    metrics_json TEXT, -- JSON
    suggestions_count INTEGER,
    status TEXT DEFAULT 'pending' 
        CHECK(status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(year, month)
);

CREATE INDEX idx_reports_year_month ON monthly_reports(year, month DESC);

-- Sample data: common institutions
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

## Storage Structure

```
data/
├── pdfs/
│   ├── 2024/
│   │   ├── 01/
│   │   │   └── {uuid}.pdf
│   │   └── 02/
│   └── 2025/
├── exports/           # JSON/CSV exports
└── backups/         # SQLite backups
```

## Migration Path (Future)

When ready for cloud deployment (Phase 2):
1. Export SQLite → PostgreSQL dump
2. Move files to S3-compatible storage
3. Update connection strings
4. Deploy to Railway/Render

## Usage

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# SQLite database
engine = create_engine('sqlite:///data/personal_finance.db')
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
from database.models import Base
Base.metadata.create_all(bind=engine)
```