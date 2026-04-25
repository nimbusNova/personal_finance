import { RobinhoodParser } from '../../lib/parsers/robinhood';

const parser = new RobinhoodParser();

// Minimal text that passes validateLayout
const BASE = [
  'robinhood',
  '03/01/2026 to 03/31/2026',
  'Michael Wu',
  'Individual Account #: 562113779',
  'Portfolio Value   $200,000.00   $206,015.67',
  'Brokerage Cash Balance *  $8,000.00  $9,230.69',
  'Portfolio Summary',
  'Securities Held in Account  Sym/Cusip  Acct Type  Qty  Price  Mkt Value  Est. Dividend Yield  % of Total Portfolio',
].join('\n');

const WITH_HOLDINGS = [
  BASE,
  'Apple',
  'Estimated Yield: 0.42% AAPL Margin 10 $175.00 $1,750.00 $9.60 0.85%',
  'Account Activity',
  'Total Funds Paid and Received',
].join('\n');

const WITH_OPTION = [
  BASE,
  'ATAI 08/21/2026 Call $5.00',
  'Estimated Yield: 0.00% ATAI Margin 1S $0.05 ($38.00) $0.00 0.01%',
  'Account Activity',
  'Total Funds Paid and Received',
].join('\n');

// ── validateLayout ────────────────────────────────────────────────────────────

describe('RobinhoodParser.validateLayout', () => {
  it('passes on valid layout', () => {
    expect(() => parser.validateLayout(BASE)).not.toThrow();
  });

  it('throws when Portfolio Summary is missing', () => {
    expect(() => parser.validateLayout(BASE.replace('Portfolio Summary', ''))).toThrow(
      /Portfolio Summary/i,
    );
  });

  it('throws when Securities Held in Account is missing', () => {
    expect(() => parser.validateLayout(BASE.replace('Securities Held in Account', ''))).toThrow(
      /Securities Held in Account/i,
    );
  });
});

// ── parse() happy path ────────────────────────────────────────────────────────

describe('RobinhoodParser.parse — metadata', () => {
  const r = parser.parse(WITH_HOLDINGS);
  const d = r.data as any;

  it('succeeds', () => expect(r.success).toBe(true));
  it('sets provider', () => expect(r.provider).toBe('dedicated_parser'));
  it('sets model', () => expect(r.model).toBe('robinhood-v1'));
  it('sets extraction_confidence to 0.99', () => expect(d.extraction_confidence).toBe(0.99));
  it('sets doc_type to brokerage', () => expect(d.doc_type).toBe('brokerage'));
  it('parses account holder', () => expect(d.account_holder).toBe('Michael Wu'));
  it('parses account number', () => expect(d.account_number).toBe('562113779'));
  it('parses statement end date', () => expect(d.statement_date).toBe('2026-03-31'));
  it('parses total value (closing balance)', () => expect(d.total_value).toBe(206015.67));
  it('parses settled cash (closing balance)', () => expect(d.cash.settled_cash).toBe(9230.69));
  it('does not include transactions (brokerage extracts holdings only)', () => {
    expect(d.transactions).toBeUndefined();
  });
});

// ── Holdings — regular equity ─────────────────────────────────────────────────

describe('RobinhoodParser.parse — equity holding', () => {
  const holdings = (parser.parse(WITH_HOLDINGS).data as any).holdings as any[];

  it('extracts at least one holding', () => expect(holdings.length).toBeGreaterThan(0));
  it('has correct symbol', () => expect(holdings[0].symbol).toBe('AAPL'));
  it('has correct name', () => expect(holdings[0].name).toBe('Apple'));
  it('sets asset_class to equity', () => expect(holdings[0].asset_class).toBe('equity'));
  it('has correct quantity', () => expect(holdings[0].quantity).toBe(10));
  it('has correct price', () => expect(holdings[0].price).toBe(175));
  it('has correct market_value', () => expect(holdings[0].market_value).toBe(1750));
});

// ── Holdings — short option ───────────────────────────────────────────────────

describe('RobinhoodParser.parse — short option (1S)', () => {
  const holdings = (parser.parse(WITH_OPTION).data as any).holdings as any[];
  const opt = holdings[0];

  it('sets asset_class to option', () => expect(opt.asset_class).toBe('option'));
  it('sets quantity to -1 for short position', () => expect(opt.quantity).toBe(-1));
  it('handles negative market value ($38.00) → -38', () => expect(opt.market_value).toBe(-38));
  it('preserves human-readable name', () =>
    expect(opt.name).toBe('ATAI 08/21/2026 Call $5.00'));
  it('uses synthetic symbol — not raw ticker — to avoid DB unique-constraint collision', () => {
    expect(opt.symbol).toMatch(/^ATAI_C_5\.00_\d{4}-\d{2}-\d{2}$/);
  });
  it('synthetic symbol encodes expiry as YYYY-MM-DD', () =>
    expect(opt.symbol).toBe('ATAI_C_5.00_2026-08-21'));
});

// ── parse() error path ────────────────────────────────────────────────────────

describe('RobinhoodParser.parse — graceful degradation', () => {
  it('does not throw on empty input', () => {
    expect(() => parser.parse('')).not.toThrow();
  });

  it('returns empty holdings on empty input', () => {
    const d = parser.parse('').data as any;
    expect(d?.holdings ?? []).toEqual([]);
  });
});
