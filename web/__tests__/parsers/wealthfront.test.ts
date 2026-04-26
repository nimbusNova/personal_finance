import { WealthfrontParser } from '../../lib/parsers/wealthfront';

const parser = new WealthfrontParser();

// Cash account text — passes validateLayout
const CASH_TEXT = [
  'wealthfront',
  '',
  'Alex Johnson',
  '123 Sample Street',
  'Anytown, CA 90210',
  '',
  'STATEMENT PERIOD             ACCOUNT NUMBER',
  'Feb. 13, 2026 to Mar. 12, 2026   1234-5678-9012-34',
  '',
  'ACCOUNT SUMMARY 1',
  'Beginning Balance on Feb. 13, 2026   $55,290.15',
  'Credits                              + $0.00',
  'Debits                               - $0.00',
  'Ending Balance on Mar. 12, 2026      $55,290.15',
  '',
  'TRANSACTIONS',
  'No Transactions',
  '',
  'SWEEP TRANSACTIONS 2',
  'DATE    DESCRIPTION    AMOUNT',
  'No Transactions',
].join('\n');

const CASH_WITH_TRANSACTIONS = [
  'wealthfront',
  '',
  'Alex Johnson',
  '123 Sample Street',
  'Anytown, CA 90210',
  '',
  'STATEMENT PERIOD             ACCOUNT NUMBER',
  'Mar. 13, 2026 to Apr. 12, 2026   1234-5678-9012-34',
  '',
  'ACCOUNT SUMMARY 1',
  'Beginning Balance on Mar. 13, 2026   $55,000.00',
  'Credits                              + $5,000.00',
  'Debits                               - $0.00',
  'Ending Balance on Apr. 12, 2026      $60,000.00',
  '',
  'TRANSACTIONS',
  '03/15/2026  ACH Transfer In  5,000.00',
  '',
  'SWEEP TRANSACTIONS 2',
  'DATE    DESCRIPTION    AMOUNT',
  '03/20/2026  Sweep Interest  12.50',
].join('\n');

// Investment account text — passes validateLayout
const INVESTMENT_TEXT = [
  'wealthfront',
  '',
  'Alex Johnson',
  '123 Sample Street',
  'Anytown, CA 90210',
  '',
  'STATEMENT PERIOD             ACCOUNT NUMBER',
  'Feb. 13, 2026 to Mar. 12, 2026   2025-1234-5678-90',
  '',
  'ACCOUNT SUMMARY',
  'Beginning Account Value  $50,000.00',
  'Ending Account Value     $52,000.00',
  '',
  'Holdings',
  'Symbol  Description  Quantity  Price  Market Value  % of Portfolio',
  'VTI  VANGUARD TOTAL STOCK MARKET ETF  20.000  $245.00  $4,900.00  45%',
  'BNDX  VANGUARD TOTAL INTL BOND ETF  30.000  $52.00  $1,560.00  14%',
].join('\n');

// ── validateLayout ────────────────────────────────────────────────────────────

describe('WealthfrontParser.validateLayout', () => {
  it('passes on cash account layout', () => {
    expect(() => parser.validateLayout(CASH_TEXT)).not.toThrow();
  });

  it('passes on investment account layout', () => {
    expect(() => parser.validateLayout(INVESTMENT_TEXT)).not.toThrow();
  });

  it('throws when ACCOUNT SUMMARY is missing', () => {
    const text = CASH_TEXT.replace('ACCOUNT SUMMARY 1', '');
    expect(() => parser.validateLayout(text)).toThrow(/ACCOUNT SUMMARY/i);
  });

  it('throws when STATEMENT PERIOD is missing', () => {
    const text = CASH_TEXT.replace('STATEMENT PERIOD', '');
    expect(() => parser.validateLayout(text)).toThrow(/STATEMENT PERIOD/i);
  });
});

// ── Cash account — metadata ───────────────────────────────────────────────────

describe('WealthfrontParser.parse — cash account metadata', () => {
  const r = parser.parse(CASH_TEXT);
  const d = r.data as any;

  it('succeeds', () => expect(r.success).toBe(true));
  it('sets provider', () => expect(r.provider).toBe('dedicated_parser'));
  it('sets model', () => expect(r.model).toBe('wealthfront-v1'));
  it('sets doc_type to bank', () => expect(d.doc_type).toBe('bank'));
  it('parses account holder', () => expect(d.account_holder).toBe('Alex Johnson'));
  it('parses account number', () => expect(d.account_number).toBe('1234-5678-9012-34'));
  it('parses statement end date', () => expect(d.statement_date).toBe('2026-03-12'));
  it('parses beginning balance', () => expect(d.beginning_balance).toBe(55290.15));
  it('parses ending balance', () => expect(d.ending_balance).toBe(55290.15));
  it('sets extraction_confidence to 0.99', () => expect(d.extraction_confidence).toBe(0.99));
});

// ── "No Transactions" → empty array ──────────────────────────────────────────

describe('WealthfrontParser.parse — No Transactions', () => {
  const txs = (parser.parse(CASH_TEXT).data as any).transactions as any[];

  it('returns an empty array when "No Transactions" is present', () => {
    expect(Array.isArray(txs)).toBe(true);
    expect(txs.length).toBe(0);
  });
});

// ── Sweep section excluded from main transactions ─────────────────────────────

describe('WealthfrontParser.parse — sweep transactions excluded', () => {
  const txs = (parser.parse(CASH_WITH_TRANSACTIONS).data as any).transactions as any[];

  it('parses main TRANSACTIONS section', () => {
    expect(txs.length).toBe(1);
  });

  it('does not include SWEEP TRANSACTIONS entries', () => {
    const sweep = txs.find((t: any) => /Sweep Interest/i.test(t.description));
    expect(sweep).toBeUndefined();
  });

  it('includes the main transaction with correct amount', () => {
    expect(txs[0].amount).toBe(5000);
  });
});

// ── Investment account branching (Q4) ─────────────────────────────────────────

describe('WealthfrontParser.parse — investment account', () => {
  const r = parser.parse(INVESTMENT_TEXT);
  const d = r.data as any;

  it('succeeds', () => expect(r.success).toBe(true));
  it('sets doc_type to brokerage', () => expect(d.doc_type).toBe('brokerage'));
  it('parses total value from Ending Account Value', () => expect(d.total_value).toBe(52000));
  it('parses holdings', () => expect(d.holdings.length).toBe(2));
  it('sets asset_class to etf for fund holdings', () => {
    expect(d.holdings[0].asset_class).toBe('etf');
  });
  it('parses first holding symbol', () => expect(d.holdings[0].symbol).toBe('VTI'));
  it('parses first holding quantity', () => expect(d.holdings[0].quantity).toBe(20));
  it('parses first holding market value', () => expect(d.holdings[0].market_value).toBe(4900));
});

// ── parse() error path ────────────────────────────────────────────────────────

describe('WealthfrontParser.parse — graceful degradation', () => {
  it('does not throw on empty input', () => {
    expect(() => parser.parse('')).not.toThrow();
  });

  it('returns empty transactions on empty input', () => {
    const d = parser.parse('').data as any;
    expect(d?.transactions ?? []).toEqual([]);
  });
});
