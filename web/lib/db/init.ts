import { sqlite } from './client';

export function initDatabase() {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
  const tableNames = new Set(tables.map((t) => t.name));

  if (tableNames.has('institutions')) {
    console.log('[db] Tables already exist');
    return;
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS institutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      logo_url TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      institution_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT,
      account_number_masked TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      UNIQUE (institution_id, name)
    );
    CREATE TABLE IF NOT EXISTS life_stage_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      age INTEGER,
      annual_income REAL,
      risk_tolerance INTEGER,
      time_horizon_years INTEGER,
      goals_json TEXT,
      target_allocation_json TEXT,
      manifesto_text TEXT,
      is_active INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS pdfs (
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
      processed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );
    CREATE TABLE IF NOT EXISTS extraction_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      error_details TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
    );
    CREATE TABLE IF NOT EXISTS manual_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      original_value TEXT,
      corrected_value TEXT,
      corrected_by TEXT DEFAULT 'user',
      correction_note TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
    );
    CREATE TABLE IF NOT EXISTS account_balances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      pdf_id INTEGER,
      statement_date INTEGER,
      balance REAL,
      currency TEXT DEFAULT 'USD',
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (pdf_id) REFERENCES pdfs(id),
      UNIQUE (account_id, statement_date)
    );
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      pdf_id INTEGER UNIQUE,
      statement_date INTEGER NOT NULL,
      total_value REAL,
      cash_balance REAL,
      invested_value REAL,
      diversity_score REAL,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (pdf_id) REFERENCES pdfs(id),
      UNIQUE (account_id, statement_date)
    );
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
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
      FOREIGN KEY (snapshot_id) REFERENCES portfolio_snapshots(id),
      UNIQUE (snapshot_id, symbol)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      pdf_id INTEGER,
      date INTEGER NOT NULL,
      merchant TEXT,
      category TEXT,
      amount REAL NOT NULL,
      is_recurring INTEGER DEFAULT 0,
      recurring_frequency TEXT,
      statement_date INTEGER,
      is_manual_correction INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (pdf_id) REFERENCES pdfs(id)
    );
    CREATE TABLE IF NOT EXISTS ai_suggestions (
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
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      FOREIGN KEY (life_stage_profile_id) REFERENCES life_stage_profiles(id)
    );
    CREATE TABLE IF NOT EXISTS monthly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      generated_at INTEGER,
      summary_text TEXT,
      metrics_json TEXT,
      suggestions_count INTEGER,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      created_at INTEGER DEFAULT (unixepoch())
    );
  `);

  console.log('[db] Initialized all tables');
}
