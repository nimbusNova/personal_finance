import { sqliteTable, integer, text, real, unique } from 'drizzle-orm/sqlite-core';

export const institutions = sqliteTable('institutions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type'),
  logoUrl: text('logo_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const accounts = sqliteTable('accounts', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  institutionId: integer('institution_id').notNull().references(() => institutions.id),
  name: text('name').notNull(),
  accountType: text('account_type'),
  accountNumberMasked: text('account_number_masked'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique('uix_account_institution_name').on(t.institutionId, t.name),
}));

export const lifeStageProfiles = sqliteTable('life_stage_profiles', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  age: integer('age', { mode: 'number' }),
  annualIncome: real('annual_income'),
  riskTolerance: integer('risk_tolerance', { mode: 'number' }),
  timeHorizonYears: integer('time_horizon_years', { mode: 'number' }),
  goalsJson: text('goals_json', { mode: 'json' }).$type<string[]>(),
  targetAllocationJson: text('target_allocation_json', { mode: 'json' }).$type<Record<string, number>>(),
  manifestoText: text('manifesto_text'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  version: integer('version', { mode: 'number' }).default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const pdfs = sqliteTable('pdfs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').references(() => accounts.id),
  originalFilename: text('original_filename'),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size', { mode: 'number' }),
  pageCount: integer('page_count', { mode: 'number' }),
  docType: text('doc_type'),
  extractionStatus: text('extraction_status').default('pending'),
  processingStep: text('processing_step'),
  extractionConfidence: real('extraction_confidence'),
  extractedData: text('extracted_data', { mode: 'json' }),
  errorMessage: text('error_message'),
  processedAt: integer('processed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const extractionJobs = sqliteTable('extraction_jobs', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  pdfId: integer('pdf_id').notNull().references(() => pdfs.id),
  jobType: text('job_type').notNull(),
  status: text('status').default('pending'),
  attempts: integer('attempts', { mode: 'number' }).default(0),
  errorDetails: text('error_details', { mode: 'json' }),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const manualCorrections = sqliteTable('manual_corrections', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  pdfId: integer('pdf_id').notNull().references(() => pdfs.id),
  fieldName: text('field_name').notNull(),
  originalValue: text('original_value'),
  correctedValue: text('corrected_value'),
  correctedBy: text('corrected_by').default('user'),
  correctionNote: text('correction_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const accountBalances = sqliteTable('account_balances', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  pdfId: integer('pdf_id').references(() => pdfs.id),
  statementDate: integer('statement_date', { mode: 'timestamp' }),
  balance: real('balance'),
  currency: text('currency').default('USD'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique('uix_balance_account_date').on(t.accountId, t.statementDate),
}));

export const portfolioSnapshots = sqliteTable('portfolio_snapshots', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  pdfId: integer('pdf_id').unique().references(() => pdfs.id),
  statementDate: integer('statement_date', { mode: 'timestamp' }).notNull(),
  totalValue: real('total_value'),
  cashBalance: real('cash_balance'),
  investedValue: real('invested_value'),
  diversityScore: real('diversity_score'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique('uix_snapshot_account_date').on(t.accountId, t.statementDate),
}));

export const holdings = sqliteTable('holdings', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id').notNull().references(() => portfolioSnapshots.id),
  symbol: text('symbol').notNull(),
  name: text('name'),
  assetClass: text('asset_class'),
  sector: text('sector'),
  geography: text('geography'),
  quantity: real('quantity'),
  price: real('price'),
  marketValue: real('market_value'),
  costBasis: real('cost_basis'),
  unrealizedPnl: real('unrealized_pnl'),
  weightPct: real('weight_pct'),
  isManualCorrection: integer('is_manual_correction', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (t) => ({
  unq: unique('uix_holding_snapshot_symbol').on(t.snapshotId, t.symbol),
}));

export const transactions = sqliteTable('transactions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  pdfId: integer('pdf_id').references(() => pdfs.id),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  merchant: text('merchant'),
  category: text('category'),
  amount: real('amount').notNull(),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).default(false),
  recurringFrequency: text('recurring_frequency'),
  statementDate: integer('statement_date', { mode: 'timestamp' }),
  isManualCorrection: integer('is_manual_correction', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const aiSuggestions = sqliteTable('ai_suggestions', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  lifeStageProfileId: integer('life_stage_profile_id').references(() => lifeStageProfiles.id),
  suggestionType: text('suggestion_type'),
  actionJson: text('action_json', { mode: 'json' }),
  reasoningText: text('reasoning_text'),
  reasoningJson: text('reasoning_json', { mode: 'json' }),
  confidenceScore: real('confidence_score'),
  priority: text('priority'),
  portfolioContext: text('portfolio_context', { mode: 'json' }),
  userFeedback: text('user_feedback'),
  userNote: text('user_note'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const monthlyReports = sqliteTable('monthly_reports', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  year: integer('year', { mode: 'number' }).notNull(),
  month: integer('month', { mode: 'number' }).notNull(),
  generatedAt: integer('generated_at', { mode: 'timestamp' }),
  summaryText: text('summary_text'),
  metricsJson: text('metrics_json', { mode: 'json' }),
  suggestionsCount: integer('suggestions_count', { mode: 'number' }),
  status: text('status').default('pending'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
