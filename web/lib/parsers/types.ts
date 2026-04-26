export type DocType = 'brokerage' | 'bank' | 'credit_card';

export interface InstitutionParser {
  readonly institution: string;
  readonly docType: DocType;
  readonly parserVersion: string;
  detect(text: string): boolean;
  /** Throws if expected structural markers are missing — signals a format version mismatch. */
  validateLayout(text: string): void;
  parse(text: string): ParseResult;
}

export interface ParseResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  confidence?: number;
  provider?: string;
  model?: string;
}

export interface Holding {
  symbol: string;
  name?: string;
  asset_class?: string;
  sector?: string;
  geography?: string;
  quantity?: number;
  price?: number;
  market_value?: number;
  cost_basis?: number;
  unrealized_pnl?: number;
  weight_pct?: number;
}

export interface Transaction {
  date?: string;
  description?: string;
  merchant?: string;
  category?: string;
  amount?: number;
  is_recurring?: boolean;
}
