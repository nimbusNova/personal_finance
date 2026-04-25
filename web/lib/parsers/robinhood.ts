import type { InstitutionParser, ParseResult, Holding, Transaction } from './types';
import { parseDollar, parseDate, extractSection } from './utils';

// Robinhood transaction type codes → human-readable category
const TX_CODE_CATEGORY: Record<string, string> = {
  CDIV:  'Income',     // cash dividend
  GDBP:  'Income',     // Gold deposit boost payment
  SLIP:  'Income',     // stock lending income payment
  GMPC:  'Fee Credit', // Gold plan credit
  Buy:   'Trade',
  Sell:  'Trade',
  STO:   'Options',    // sell to open
  BTC:   'Options',    // buy to close
  STC:   'Options',    // sell to close
  BTO:   'Options',    // buy to open
  OASGN: 'Options',   // option assignment
  OEXP:  'Options',    // option expiration
  ACH:   'Transfer',
  ACATS: 'Transfer',
};

export class RobinhoodParser implements InstitutionParser {
  readonly institution = 'Robinhood';
  readonly docType = 'brokerage' as const;

  detect(text: string): boolean {
    const head = text.slice(0, 600).toLowerCase();
    return (
      head.includes('robinhood') ||
      head.includes('500 colonial center parkway') ||
      head.includes('help@robinhood.com')
    );
  }

  parse(text: string): ParseResult {
    try {
      const data = this._parse(text);
      return { success: true, data, confidence: 0.99, provider: 'dedicated_parser', model: 'robinhood-v1' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Main ────────────────────────────────────────────────────────────────

  private _parse(text: string): Record<string, unknown> {
    const period = this._parsePeriod(text);

    return {
      doc_type:              'brokerage',
      institution:           'Robinhood',
      account_type:          'Individual Brokerage',
      account_holder:        this._parseHolder(text),
      account_number:        this._parseAccountNumber(text),
      statement_date:        period.end_date,
      statement_period:      { start_date: period.start_date, end_date: period.end_date },
      holdings:              this._parseHoldings(text),
      cash:                  this._parseCash(text),
      total_value:           this._parseTotalValue(text),
      income_summary:        this._parseIncomeSummary(text),
      transactions:          this._parseTransactions(text, period.end_date),
      extraction_confidence: 0.99,
    };
  }

  // ── Header / account info ────────────────────────────────────────────────

  private _parseHolder(text: string): string {
    // "03/01/2026 to 03/31/2026\nMichael Wu\nIndividual Account #:562113779"
    const m = text.match(/\d{2}\/\d{2}\/\d{4}\s+to\s+\d{2}\/\d{2}\/\d{4}\s*\n([^\n]+)\n/);
    return m ? m[1].trim() : '';
  }

  private _parseAccountNumber(text: string): string {
    const m = text.match(/Individual\s+Account\s+#[:\s]*(\d+)/i);
    return m ? m[1] : '';
  }

  private _parsePeriod(text: string): { start_date: string; end_date: string } {
    const m = text.match(/(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})/);
    if (m) return { start_date: parseDate(m[1]), end_date: parseDate(m[2]) };
    return { start_date: '', end_date: '' };
  }

  // ── Account summary ──────────────────────────────────────────────────────

  private _parseTotalValue(text: string): number {
    // "Portfolio Value   $206,015.67   $203,193.26"  — we want the closing (second) value
    const m = text.match(/Portfolio\s+Value\s+\$[\d,]+\.\d{2}\s+\$([\d,]+\.\d{2})/i);
    if (m) return parseDollar(m[1]);
    // Fallback: "Total Priced Portfolio  $203,193.26"
    const m2 = text.match(/Total\s+Priced\s+Portfolio\s+\$([\d,]+\.\d{2})/i);
    return m2 ? parseDollar(m2[1]) : 0;
  }

  private _parseCash(text: string): { settled_cash: number; unsettled_cash: number } {
    // "Brokerage Cash Balance *  $30,761.03  $9,230.69" — closing value is second
    const m = text.match(/Brokerage\s+Cash\s+Balance\s+\*?\s+\$[\d,]+\.\d{2}\s+\$([\d,]+\.\d{2})/i);
    return {
      settled_cash:   m ? parseDollar(m[1]) : 0,
      unsettled_cash: 0,
    };
  }

  private _parseIncomeSummary(text: string): Record<string, number> {
    // "Income and Expense Summary  This Period  Year to Date"
    // "Dividends  $169.23  $272.73"
    const divP  = text.match(/^Dividends\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})/im);
    const slipP = text.match(/^Stock\s+Lending\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})/im);

    return {
      dividends_period:      divP  ? parseDollar(divP[1])  : 0,
      dividends_ytd:         divP  ? parseDollar(divP[2])  : 0,
      stock_lending_period:  slipP ? parseDollar(slipP[1]) : 0,
      stock_lending_ytd:     slipP ? parseDollar(slipP[2]) : 0,
    };
  }

  // ── Holdings (Portfolio Summary) ─────────────────────────────────────────

  private _parseHoldings(text: string): Holding[] {
    // Section starts after "Portfolio Summary" header line
    const section = extractSection(
      text,
      /Portfolio\s+Summary\s*\n/i,
      /Account\s+Activity|Total\s+Securities\s+\*|Loaned\s+Securities/i,
    );
    if (!section) return [];

    const holdings: Holding[] = [];

    // Each holding occupies exactly TWO consecutive lines:
    //   Line 1: security name (e.g. "Apple" or "ATAI 08/21/2026 Call $5.00")
    //   Line 2: "Estimated Yield: X.XX%  SYMBOL  AcctType  QTY  $PRICE  $MKTVAL  $DIVYLD  PCT%"
    //
    // We scan for all "Estimated Yield:" lines and grab the preceding line as the name.
    const lines = section.split('\n');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();

      const yieldMatch = line.match(
        /^Estimated\s+Yield:\s*([\d.]+)%\s+(\S+)\s+(\S+)\s+(\S+)\s+\$([\d.]+)\s+([\d,$().-]+)\s/,
      );
      if (!yieldMatch) continue;

      const symbol   = yieldMatch[2];
      const acctType = yieldMatch[3]; // "Margin" | "Cash"
      const rawQty   = yieldMatch[4]; // "33.069475" or "1S"
      const price    = parseFloat(yieldMatch[5]) || 0;
      const rawMkt   = yieldMatch[6];

      const isShort  = rawQty === '1S';
      const quantity = isShort ? -1 : (parseFloat(rawQty) || 0);
      const mktVal   = parseDollar(rawMkt); // handles ($38.00) → -38

      // Name comes from the preceding non-empty line
      let name = '';
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (prev && !/Estimated\s+Yield:|Page\s+\d+\s+of|Portfolio\s+Summary|Securities\s+Held/i.test(prev)) {
          name = prev;
          break;
        }
      }

      // Determine asset class from name pattern
      const isOption = /\b(Call|Put)\b/.test(name) || /\b(Call|Put)\b/.test(symbol);
      const assetClass = isOption ? 'option' : 'equity';

      // % of total portfolio — last token ending in %
      const pctMatch = line.match(/([\d.]+)%\s*$/);
      const weightPct = pctMatch ? parseFloat(pctMatch[1]) / 100 : undefined;

      holdings.push({
        symbol,
        name,
        asset_class: assetClass,
        quantity,
        price,
        market_value: mktVal,
        weight_pct:   weightPct,
      });
    }

    return holdings;
  }

  // ── Transactions (Account Activity) ──────────────────────────────────────

  private _parseTransactions(text: string, statementDate: string): Transaction[] {
    const section = extractSection(
      text,
      /Account\s+Activity\s*\n/i,
      /Total\s+Funds\s+Paid\s+and\s+Received|Executed\s+Trades\s+Pending/i,
    );
    if (!section) return [];

    const txs: Transaction[] = [];
    const year = statementDate ? statementDate.slice(0, 4) : '';

    // Strategy: find lines that contain a MM/DD/YYYY date followed by a dollar amount.
    // These are the "primary" rows with a debit or credit value.
    //
    // Row format (variable):
    //   {desc} {symbol} {accttype} {txCode} {MM/DD/YYYY} [{qty}] [{price}] [{debit}] [{credit}]
    //
    // We anchor on the date and scrape amounts from the end of the line.
    const lineRe = /^(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s*(.*)/gm;
    let m: RegExpExecArray | null;

    while ((m = lineRe.exec(section)) !== null) {
      const beforeDate = m[1].trim();
      const date       = parseDate(m[2]);
      const afterDate  = m[3].trim();

      // Skip header lines
      if (/Description\s+Symbol|Transaction\s+Date/i.test(beforeDate)) continue;

      // Extract debit / credit amounts from afterDate
      // afterDate is like: "100 $70.00000 $7,000.00" or "$12.89" or "1" (option qty only)
      const dollars = [...afterDate.matchAll(/\$([\d,]+\.\d{2})/g)].map(n => parseDollar(n[1]));

      if (dollars.length === 0) continue; // informational row (e.g. OASGN notification)

      // Debit = last dollar if afterDate contains the word "Debit" pattern or if negative context
      // Credit = last dollar if line is a credit
      // Heuristic: if there's only one amount and the description contains "Debit"/"Withdrawal" → debit
      const lastAmount = dollars[dollars.length - 1];

      // Detect debit vs credit from beforeDate context
      const isDebit = /\b(BTC|BTO|Buy|ACH\s+Deposit\s*-|OASGN)\b/.test(beforeDate);
      const amount  = isDebit ? -lastAmount : lastAmount;

      // Derive transaction code and category
      const codeMatch = beforeDate.match(/\b(CDIV|GDBP|SLIP|GMPC|BTC|STO|STC|BTO|OASGN|OEXP|ACH|ACATS|Buy|Sell)\b/);
      const code      = codeMatch ? codeMatch[1] : '';
      const category  = TX_CODE_CATEGORY[code] || 'Trade';

      txs.push({
        date,
        description: beforeDate,
        merchant:    beforeDate,
        category,
        amount,
      });
    }

    return txs;
  }
}
