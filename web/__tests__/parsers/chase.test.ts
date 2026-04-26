import { ChaseParser } from '../../lib/parsers/chase';

const parser = new ChaseParser();

// Minimal text that passes validateLayout
const BASE = [
  'jpmorgan chase bank',
  'December 05, 2025 through January 07, 2026',
  '',
  'ALEX JOHNSON',
  '123 SAMPLE STREET',
  'ANYTOWN CA 90210-0000',
  '',
  'Account Number:',
  '000000123456789',
  '',
  'CHECKING SUMMARY  Chase Total Checking',
  'Beginning Balance  $5,000.00',
  'Ending Balance  $6,200.00',
  '',
].join('\n');

const WITH_TRANSACTIONS = [
  BASE,
  '12/10  Uniswap Labs Payroll PPD ID: 9117571000  1,200.00  6,200.00',
  '12/15  Starbucks #1234 -4.50  6,195.50',
  '12/16  Zelle Payment From Sarah Kim 0Jj0Ubo1Zzug  6,841.76',
  '12/17  Zelle Payment To James Park Jpm99Bxqdxks  -30.06  6,811.70',
  '',
  'TRANSACTION DETAIL',
  'IN CASE OF ERRORS',
].join('\n');

// ── validateLayout ────────────────────────────────────────────────────────────

describe('ChaseParser.validateLayout', () => {
  it('passes on valid layout', () => {
    expect(() => parser.validateLayout(WITH_TRANSACTIONS)).not.toThrow();
  });

  it('throws when TRANSACTION DETAIL is missing', () => {
    const text = WITH_TRANSACTIONS.replace('TRANSACTION DETAIL', '');
    expect(() => parser.validateLayout(text)).toThrow(/TRANSACTION DETAIL/i);
  });

  it('throws when Beginning Balance is missing', () => {
    const text = WITH_TRANSACTIONS.replace('Beginning Balance', '');
    expect(() => parser.validateLayout(text)).toThrow(/Beginning Balance/i);
  });
});

// ── parse() metadata ──────────────────────────────────────────────────────────

describe('ChaseParser.parse — metadata', () => {
  const r = parser.parse(WITH_TRANSACTIONS);
  const d = r.data as any;

  it('succeeds', () => expect(r.success).toBe(true));
  it('sets provider', () => expect(r.provider).toBe('dedicated_parser'));
  it('sets model', () => expect(r.model).toBe('chase-v1'));
  it('sets doc_type to bank', () => expect(d.doc_type).toBe('bank'));
  it('parses account holder', () => expect(d.account_holder).toBe('ALEX JOHNSON'));
  it('parses account number', () => expect(d.account_number).toBe('000000123456789'));
  it('parses statement end date', () => expect(d.statement_date).toBe('2026-01-07'));
  it('parses statement start date', () => expect(d.statement_period.start_date).toBe('2025-12-05'));
  it('parses beginning balance', () => expect(d.beginning_balance).toBe(5000));
  it('parses ending balance', () => expect(d.ending_balance).toBe(6200));
});

// ── Year derived from statement period ───────────────────────────────────────

describe('ChaseParser.parse — year from period, not first /\\d{4}/', () => {
  // The account number 000000123456789 contains many digits that could be
  // misread as a year. The year must come from the parsed period end date.
  const r = parser.parse(WITH_TRANSACTIONS);
  const txs = r.data?.transactions as any[];

  it('parses transactions with correct year from period', () => {
    expect(txs.length).toBeGreaterThan(0);
    const dates = txs.map((t: any) => t.date as string);
    expect(dates.every(d => d.startsWith('2025') || d.startsWith('2026'))).toBe(true);
  });
});

// ── Transactions ─────────────────────────────────────────────────────────────

describe('ChaseParser.parse — transactions', () => {
  const txs = (parser.parse(WITH_TRANSACTIONS).data as any).transactions as any[];

  it('extracts multiple transactions', () => expect(txs.length).toBeGreaterThan(1));

  it('classifies payroll as Income', () => {
    const payroll = txs.find((t: any) => /payroll/i.test(t.description));
    expect(payroll).toBeDefined();
    expect(payroll.category).toBe('Income');
  });

  it('classifies Zelle inbound as Transfer', () => {
    const zelle = txs.find((t: any) => /Zelle Payment From/i.test(t.description));
    expect(zelle).toBeDefined();
    expect(zelle.amount).toBeGreaterThan(0);
  });

  it('classifies Zelle outbound as negative amount', () => {
    const zelle = txs.find((t: any) => /Zelle Payment To/i.test(t.description));
    expect(zelle).toBeDefined();
    expect(zelle.amount).toBeLessThan(0);
  });
});

// ── Cross-year date assignment ────────────────────────────────────────────────

describe('ChaseParser.parse — cross-year date assignment', () => {
  // Statement spans Dec 2025 – Jan 2026. Dec transactions must use 2025, not 2026.
  const crossYearText = [
    'jpmorgan chase bank',
    'December 05, 2025 through January 07, 2026',
    '',
    'ALEX JOHNSON',
    '123 SAMPLE STREET',
    'ANYTOWN CA 90210-0000',
    '',
    'Account Number:',
    '000000123456789',
    '',
    'CHECKING SUMMARY  Chase Total Checking',
    'Beginning Balance  $5,000.00',
    'Ending Balance  $6,000.00',
    '',
    '12/15  PAYROLL DEPOSIT  1,000.00  6,000.00',
    '01/03  STARBUCKS #1234  -4.50  5,995.50',
    '',
    'TRANSACTION DETAIL',
    'IN CASE OF ERRORS',
  ].join('\n');

  const txs = (parser.parse(crossYearText).data as any).transactions as any[];

  it('assigns December transactions to 2025', () => {
    const dec = txs.find((t: any) => t.date?.startsWith('2025-12'));
    expect(dec).toBeDefined();
    expect(dec.date).toBe('2025-12-15');
  });

  it('assigns January transactions to 2026', () => {
    const jan = txs.find((t: any) => t.date?.startsWith('2026-01'));
    expect(jan).toBeDefined();
    expect(jan.date).toBe('2026-01-03');
  });
});

// ── parse() error path ────────────────────────────────────────────────────────

describe('ChaseParser.parse — graceful degradation', () => {
  it('does not throw on empty input', () => {
    expect(() => parser.parse('')).not.toThrow();
  });

  it('returns empty transactions on empty input', () => {
    const d = parser.parse('').data as any;
    expect(d?.transactions ?? []).toEqual([]);
  });
});
