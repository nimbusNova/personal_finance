import { SchwabParser } from '../../lib/parsers/schwab';

const parser = new SchwabParser();

// Minimal text that passes validateLayout
const BASE = [
  'charles schwab',
  'Schwab One® Account of',
  'MICHAEL WU',
  'Account Number  7406-8532',
  'Statement Period',
  'March 1-31, 2026',
  'Ending Account Value  $150,000.00',
  'Deposits  500.00',
  'Positions - Equities',
  'Symbol  Description  Quantity  Price($)  Market Value($)  Cost Basis($)  Unrealized Gain/Loss($)',
].join('\n');

const WITH_EQUITIES = [
  BASE,
  'AAPL APPLE INC (M),◊ 10.0000 175.00 1,750.00 1,500.00 250.00',
  'GOOGL ALPHABET INC (M),◊ 5.0000 165.00 825.00 700.00 125.00',
].join('\n');

const WITH_ALL_SECTIONS = [
  BASE,
  'AAPL APPLE INC (M),◊ 10.0000 175.00 1,750.00 1,500.00 250.00',
  '',
  'Positions - Exchange Traded Funds',
  'Symbol  Description  Quantity  Price($)  Market Value($)  Cost Basis($)  Unrealized Gain/Loss($)',
  'VTI VANGUARD TOTAL STOCK (M),◊ 20.0000 245.00 4,900.00 4,000.00 900.00',
  '',
  'Positions - Other Assets',
  'Symbol  Description  Quantity  Price($)  Market Value($)  Cost Basis($)  Unrealized Gain/Loss($)',
  'O REALTY INCOME CORP REIT 50.0000 55.00 2,750.00 2,500.00 250.00',
].join('\n');

// ── validateLayout ────────────────────────────────────────────────────────────

describe('SchwabParser.validateLayout', () => {
  it('passes on valid layout', () => {
    expect(() => parser.validateLayout(BASE)).not.toThrow();
  });

  it('throws when Statement Period is missing', () => {
    const text = BASE.replace('Statement Period', '');
    expect(() => parser.validateLayout(text)).toThrow(/Statement Period/i);
  });

  it('throws when Positions section is missing', () => {
    const text = BASE.replace('Positions - Equities', '');
    expect(() => parser.validateLayout(text)).toThrow(/Positions/i);
  });
});

// ── parse() metadata ──────────────────────────────────────────────────────────

describe('SchwabParser.parse — metadata', () => {
  const r = parser.parse(WITH_EQUITIES);
  const d = r.data as any;

  it('succeeds', () => expect(r.success).toBe(true));
  it('sets provider', () => expect(r.provider).toBe('dedicated_parser'));
  it('sets model', () => expect(r.model).toBe('schwab-v1'));
  it('sets doc_type to brokerage', () => expect(d.doc_type).toBe('brokerage'));
  it('parses account number', () => expect(d.account_number).toBe('7406-8532'));
  it('parses statement end date', () => expect(d.statement_date).toBe('2026-03-31'));
  it('parses total value', () => expect(d.total_value).toBe(150000));
  it('sets extraction_confidence to 0.99', () => expect(d.extraction_confidence).toBe(0.99));
  it('does not include transactions (brokerage extracts holdings only)', () => {
    expect(d.transactions).toBeUndefined();
  });
});

// ── Annotation stripping ──────────────────────────────────────────────────────

describe('SchwabParser.parse — (M),◊ annotation stripping', () => {
  const holdings = (parser.parse(WITH_EQUITIES).data as any).holdings as any[];

  it('strips (M) and ◊ from security names', () => {
    const aapl = holdings.find((h: any) => h.symbol === 'AAPL');
    expect(aapl).toBeDefined();
    expect(aapl.name).not.toContain('(M)');
    expect(aapl.name).not.toContain('◊');
  });

  it('sets correct market value', () => {
    const aapl = holdings.find((h: any) => h.symbol === 'AAPL');
    expect(aapl.market_value).toBe(1750);
  });

  it('sets correct cost basis', () => {
    const aapl = holdings.find((h: any) => h.symbol === 'AAPL');
    expect(aapl.cost_basis).toBe(1500);
  });
});

// ── Three position sections → combined holdings[] ─────────────────────────────

describe('SchwabParser.parse — three position sections combined', () => {
  const holdings = (parser.parse(WITH_ALL_SECTIONS).data as any).holdings as any[];

  it('combines all three sections into one holdings array', () => {
    expect(holdings.length).toBe(3);
  });

  it('sets asset_class to equity for Positions - Equities', () => {
    const aapl = holdings.find((h: any) => h.symbol === 'AAPL');
    expect(aapl?.asset_class).toBe('equity');
  });

  it('sets asset_class to etf for Positions - Exchange Traded Funds', () => {
    const vti = holdings.find((h: any) => h.symbol === 'VTI');
    expect(vti?.asset_class).toBe('etf');
  });

  it('sets asset_class to reit for Positions - Other Assets', () => {
    const o = holdings.find((h: any) => h.symbol === 'O');
    expect(o?.asset_class).toBe('reit');
  });
});

// ── parse() error path ────────────────────────────────────────────────────────

describe('SchwabParser.parse — graceful degradation', () => {
  it('does not throw on empty input', () => {
    expect(() => parser.parse('')).not.toThrow();
  });

  it('returns empty holdings on empty input', () => {
    const d = parser.parse('').data as any;
    expect(d?.holdings ?? []).toEqual([]);
  });
});
