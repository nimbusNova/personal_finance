import { parseDollar, parseDate, parseDateRange, stripAnnotations, extractSection, inferCategory } from '../../lib/parsers/utils';
import { findParser } from '../../lib/parsers/registry';
import { RobinhoodParser } from '../../lib/parsers/robinhood';
import { WealthfrontParser } from '../../lib/parsers/wealthfront';
import { SchwabParser } from '../../lib/parsers/schwab';
import { ChaseParser } from '../../lib/parsers/chase';

// ── utils ────────────────────────────────────────────────────────────────────

describe('parseDollar', () => {
  it('parses plain dollar string', () => expect(parseDollar('$1,234.56')).toBe(1234.56));
  it('parses negative parentheses notation', () => expect(parseDollar('($38.00)')).toBe(-38));
  it('parses number without symbol', () => expect(parseDollar('9230.69')).toBe(9230.69));
  it('returns 0 for empty string', () => expect(parseDollar('')).toBe(0));
  it('handles commas and spaces', () => expect(parseDollar('$206,015.67')).toBe(206015.67));
});

describe('parseDate', () => {
  it('parses MM/DD/YYYY', () => expect(parseDate('03/31/2026')).toBe('2026-03-31'));
  it('parses MM/DD with yearHint', () => expect(parseDate('03/02', '2026')).toBe('2026-03-02'));
  it('parses "Month DD, YYYY"', () => expect(parseDate('December 05, 2025')).toBe('2025-12-05'));
  it('parses "Mon. DD, YYYY"', () => expect(parseDate('Mar. 12, 2026')).toBe('2026-03-12'));
  it('parses Schwab range string returning end day', () => expect(parseDate('March 1-31, 2026')).toBe('2026-03-31'));
  it('passes through unknown formats unchanged', () => expect(parseDate('unknown')).toBe('unknown'));
});

describe('parseDateRange', () => {
  it('parses Schwab "Month D-DD, YYYY"', () => {
    expect(parseDateRange('March 1-31, 2026')).toEqual({ start: '2026-03-01', end: '2026-03-31' });
  });
  it('parses Chase "Month DD, YYYY through Month DD, YYYY"', () => {
    expect(parseDateRange('December 05, 2025 through January 07, 2026')).toEqual({
      start: '2025-12-05',
      end: '2026-01-07',
    });
  });
  it('parses Wealthfront "Mon. DD, YYYY to Mon. DD, YYYY"', () => {
    expect(parseDateRange('Feb. 13, 2026 to Mar. 12, 2026')).toEqual({
      start: '2026-02-13',
      end: '2026-03-12',
    });
  });
  it('parses Robinhood "MM/DD/YYYY to MM/DD/YYYY"', () => {
    expect(parseDateRange('03/01/2026 to 03/31/2026')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });
  it('returns null for unrecognised format', () => {
    expect(parseDateRange('')).toBeNull();
  });
});

describe('stripAnnotations', () => {
  it('removes (M) and ◊ tokens', () => {
    expect(stripAnnotations('APPLE INC (M),◊')).toBe('APPLE INC');
  });
  it('removes standalone ◊', () => {
    expect(stripAnnotations('VANGUARD ETF◊')).toBe('VANGUARD ETF');
  });
  it('leaves clean strings unchanged', () => {
    expect(stripAnnotations('GOOGL')).toBe('GOOGL');
  });
});

describe('extractSection', () => {
  const text = 'header\nSection Start\nline1\nline2\nSection End\nfooter';

  it('returns content between start and end patterns', () => {
    expect(extractSection(text, /Section Start\n/, /Section End/)).toBe('line1\nline2\n');
  });

  it('returns rest of string when end pattern is absent', () => {
    expect(extractSection(text, /Section Start\n/, /NONEXISTENT/)).toBe('line1\nline2\nSection End\nfooter');
  });

  it('returns empty string when start pattern is absent', () => {
    expect(extractSection(text, /NONEXISTENT/, /Section End/)).toBe('');
  });
});

describe('inferCategory', () => {
  it('classifies payroll as Income', () => expect(inferCategory('PAYROLL DEPOSIT')).toBe('Income'));
  it('classifies Robinhood transfer as Brokerage Transfer', () => expect(inferCategory('ROBINHOOD MONEYLINK')).toBe('Brokerage Transfer'));
  it('classifies Starbucks as Food & Dining', () => expect(inferCategory('STARBUCKS #1234')).toBe('Food & Dining'));
  it('falls back to Other', () => expect(inferCategory('RANDOM VENDOR')).toBe('Other'));
});

// ── registry / findParser ─────────────────────────────────────────────────────

describe('findParser registry', () => {
  // findParser now calls detect() AND validateLayout() — texts must include layout markers.

  it('returns RobinhoodParser for Robinhood text', () => {
    const p = findParser(
      'robinhood\nPortfolio Summary\nSecurities Held in Account',
    );
    expect(p).toBeInstanceOf(RobinhoodParser);
  });

  it('returns WealthfrontParser for Wealthfront text', () => {
    const p = findParser(
      'wealthfront\nACCOUNT SUMMARY\nSTATEMENT PERIOD',
    );
    expect(p).toBeInstanceOf(WealthfrontParser);
  });

  it('returns SchwabParser for Charles Schwab text', () => {
    const p = findParser(
      'charles schwab\nStatement Period\nMarch 1-31, 2026\nPositions - Equities',
    );
    expect(p).toBeInstanceOf(SchwabParser);
  });

  it('returns ChaseParser for JPMorgan Chase text', () => {
    const p = findParser(
      'jpmorgan chase bank\nTRANSACTION DETAIL\nBeginning Balance $5,000.00',
    );
    expect(p).toBeInstanceOf(ChaseParser);
  });

  it('returns null for unrecognised institution', () => {
    expect(findParser('some random financial document')).toBeNull();
  });

  it('returns null when institution detected but layout mismatches', () => {
    // Robinhood detected but Portfolio Summary is missing — layout mismatch
    expect(findParser('robinhood brokerage')).toBeNull();
  });
});

// ── per-parser detect() ───────────────────────────────────────────────────────

describe('RobinhoodParser.detect', () => {
  const parser = new RobinhoodParser();
  it('detects by name', () => expect(parser.detect('robinhood brokerage')).toBe(true));
  it('detects by address', () => expect(parser.detect('500 colonial center parkway')).toBe(true));
  it('detects by email', () => expect(parser.detect('help@robinhood.com')).toBe(true));
  it('rejects other text', () => expect(parser.detect('charles schwab')).toBe(false));
});

describe('WealthfrontParser.detect', () => {
  const parser = new WealthfrontParser();
  it('detects by name', () => expect(parser.detect('wealthfront cash account')).toBe(true));
  it('rejects other text', () => expect(parser.detect('chase bank')).toBe(false));
});

describe('SchwabParser.detect', () => {
  const parser = new SchwabParser();
  it('detects by charles+schwab', () => expect(parser.detect('charles schwab brokerage')).toBe(true));
  it('detects by schwab one', () => expect(parser.detect('schwab one account')).toBe(true));
  it('detects by schwab.com', () => expect(parser.detect('www.schwab.com')).toBe(true));
  it('rejects other text', () => expect(parser.detect('wealthfront')).toBe(false));
});

describe('ChaseParser.detect', () => {
  const parser = new ChaseParser();
  it('detects by jpmorgan chase', () => expect(parser.detect('jpmorgan chase bank')).toBe(true));
  it('detects by chase total checking', () => expect(parser.detect('chase total checking account')).toBe(true));
  it('detects by chase.com', () => expect(parser.detect('visit chase.com')).toBe(true));
  it('rejects other text', () => expect(parser.detect('bank of america')).toBe(false));
});

// ── per-parser parse() with synthetic text ───────────────────────────────────

describe('RobinhoodParser.parse', () => {
  const parser = new RobinhoodParser();

  const syntheticText = [
    'robinhood',
    '03/01/2026 to 03/31/2026',
    'Alex Johnson',
    'Individual Account #: 123456789',
    '',
    'Portfolio Value   $200,000.00   $206,015.67',
    'Brokerage Cash Balance *  $8,000.00  $9,230.69',
    '',
    'Income and Expense Summary  This Period  Year to Date',
    'Dividends  $169.23  $272.73',
    '',
    'Portfolio Summary',
    'Apple',
    'Estimated Yield: 0.55% AAPL Margin 10 $175.00 $1,750.00 $9.60 0.85%',
    '',
    'Account Activity',
    'CDIV AAPL Margin 03/15/2026 $12.89',
    'Total Funds Paid and Received',
  ].join('\n');

  it('returns success', () => {
    const r = parser.parse(syntheticText);
    expect(r.success).toBe(true);
  });

  it('sets provider and model', () => {
    const r = parser.parse(syntheticText);
    expect(r.provider).toBe('dedicated_parser');
    expect(r.model).toBe('robinhood-v1');
  });

  it('parses account holder', () => {
    const r = parser.parse(syntheticText);
    expect(r.data?.account_holder).toBe('Alex Johnson');
  });

  it('parses account number', () => {
    const r = parser.parse(syntheticText);
    expect(r.data?.account_number).toBe('123456789');
  });

  it('parses statement date', () => {
    const r = parser.parse(syntheticText);
    expect(r.data?.statement_date).toBe('2026-03-31');
  });

  it('parses total value (closing)', () => {
    const r = parser.parse(syntheticText);
    expect(r.data?.total_value).toBe(206015.67);
  });

  it('parses settled cash (closing)', () => {
    const r = parser.parse(syntheticText);
    expect((r.data?.cash as any)?.settled_cash).toBe(9230.69);
  });

  it('parses holdings', () => {
    const r = parser.parse(syntheticText);
    const holdings = r.data?.holdings as any[];
    expect(holdings.length).toBeGreaterThan(0);
    expect(holdings[0].symbol).toBe('AAPL');
    expect(holdings[0].quantity).toBe(10);
    expect(holdings[0].price).toBe(175);
    expect(holdings[0].market_value).toBe(1750);
  });

  it('parses dividends income summary', () => {
    const r = parser.parse(syntheticText);
    const income = r.data?.income_summary as any;
    expect(income?.dividends_period).toBe(169.23);
    expect(income?.dividends_ytd).toBe(272.73);
  });
});

describe('WealthfrontParser.parse', () => {
  const parser = new WealthfrontParser();

  const syntheticText = [
    'Alex Johnson',
    '1234-5678-9012-34',
    'Feb. 13, 2026 to Mar. 12, 2026',
    '',
    'Beginning Balance  $10,000.00',
    'Credits  +  $500.00',
    'Debits  -  $200.00',
    'Ending Balance  $10,300.00',
    '',
    'TRANSACTIONS',
    'No Transactions',
    '',
    'SWEEP TRANSACTIONS',
  ].join('\n');

  it('returns success', () => {
    expect(parser.parse(syntheticText).success).toBe(true);
  });

  it('sets doc_type to bank', () => {
    expect(parser.parse(syntheticText).data?.doc_type).toBe('bank');
  });

  it('parses account number', () => {
    expect(parser.parse(syntheticText).data?.account_number).toBe('1234-5678-9012-34');
  });

  it('parses statement date', () => {
    expect(parser.parse(syntheticText).data?.statement_date).toBe('2026-03-12');
  });

  it('parses beginning and ending balance', () => {
    const d = parser.parse(syntheticText).data as any;
    expect(d.beginning_balance).toBe(10000);
    expect(d.ending_balance).toBe(10300);
  });

  it('returns empty transactions when "No Transactions"', () => {
    const txs = parser.parse(syntheticText).data?.transactions as any[];
    expect(txs).toEqual([]);
  });
});

describe('ChaseParser.parse', () => {
  const parser = new ChaseParser();

  const syntheticText = [
    'jpmorgan chase bank',
    '',
    'ALEX JOHNSON',
    '123 SAMPLE STREET',
    'ANYTOWN CA 90210-0000',
    '',
    'Account Number:',
    '000000123456789',
    '',
    'CHECKING SUMMARY  Chase Total Checking',
    '',
    'December 05, 2025 through January 07, 2026',
    '',
    'Beginning Balance  $5,000.00',
    'Deposits and Additions  1,200.00',
    'Ending Balance  $6,200.00',
    '',
    'TRANSACTION DETAIL',
    'DATE  DESCRIPTION  AMOUNT  BALANCE',
    '12/10  PAYROLL DEPOSIT  1,200.00  6,200.00',
    '12/15  STARBUCKS #1234  -4.50  6,195.50',
    '',
    'IN CASE OF ERRORS',
  ].join('\n');

  it('returns success', () => {
    expect(parser.parse(syntheticText).success).toBe(true);
  });

  it('sets doc_type to bank', () => {
    expect(parser.parse(syntheticText).data?.doc_type).toBe('bank');
  });

  it('parses account holder', () => {
    expect(parser.parse(syntheticText).data?.account_holder).toBe('ALEX JOHNSON');
  });

  it('parses account number', () => {
    expect(parser.parse(syntheticText).data?.account_number).toBe('000000123456789');
  });

  it('parses statement period', () => {
    const d = parser.parse(syntheticText).data as any;
    expect(d.statement_period.start_date).toBe('2025-12-05');
    expect(d.statement_period.end_date).toBe('2026-01-07');
  });

  it('parses beginning balance', () => {
    expect(parser.parse(syntheticText).data?.beginning_balance).toBe(5000);
  });
});

describe('SchwabParser.parse', () => {
  const parser = new SchwabParser();

  const syntheticText = [
    'charles schwab',
    '',
    'Schwab One® Account of',
    '',
    'ALEX JOHNSON',
    '',
    'Account Number  9876-5432',
    '',
    'Statement Period',
    'March 1-31, 2026',
    '',
    'Ending Account Value  $150,000.00',
    '',
    'Deposits  500.00',
    'Withdrawals  200.00',
    '',
    'Positions - Equities',
    'Symbol  Description  Quantity  Price($)  Market Value($)  Cost Basis($)  Unrealized Gain/Loss($)',
    'AAPL APPLE INC 10.0000 175.00 1,750.00 1,500.00 250.00',
    '',
    'Transaction Details',
    '03/15 Dividend ETR ENTERGY CORP NEW 0.0036 107.1229 (0.39)',
  ].join('\n');

  it('returns success', () => {
    expect(parser.parse(syntheticText).success).toBe(true);
  });

  it('sets doc_type to brokerage', () => {
    expect(parser.parse(syntheticText).data?.doc_type).toBe('brokerage');
  });

  it('parses account number', () => {
    expect(parser.parse(syntheticText).data?.account_number).toBe('9876-5432');
  });

  it('parses statement end date', () => {
    expect(parser.parse(syntheticText).data?.statement_date).toBe('2026-03-31');
  });

  it('parses total value', () => {
    expect(parser.parse(syntheticText).data?.total_value).toBe(150000);
  });
});
