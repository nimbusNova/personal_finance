import type { InstitutionParser, ParseResult, Holding, Transaction } from './types';
import { parseDollar, parseDate, parseDateRange, inferCategory } from './utils';

export class WealthfrontParser implements InstitutionParser {
  readonly institution = 'Wealthfront';
  readonly docType = 'bank' as const;
  readonly parserVersion = 'wealthfront-v1';

  detect(text: string): boolean {
    const head = text.slice(0, 600).toLowerCase();
    return (
      head.includes('wealthfront') ||
      head.includes('support@wealthfront.com')
    );
  }

  validateLayout(text: string): void {
    if (!/ACCOUNT SUMMARY/i.test(text)) {
      throw new Error('Missing "ACCOUNT SUMMARY" section');
    }
    if (!/STATEMENT PERIOD/i.test(text)) {
      throw new Error('Missing "STATEMENT PERIOD" field');
    }
  }

  parse(text: string): ParseResult {
    try {
      const data = this._parse(text);
      return { success: true, data, confidence: 0.99, provider: 'dedicated_parser', model: 'wealthfront-v1' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private _parse(text: string): Record<string, unknown> {
    const isInvestment = /\bHoldings\b/i.test(text) && /Symbol\s+Description/i.test(text);
    if (isInvestment) return this._parseInvestmentAccount(text);
    return this._parseCashAccount(text);
  }

  private _parseCashAccount(text: string): Record<string, unknown> {
    return {
      doc_type: 'bank',
      institution: 'Wealthfront',
      account_name: 'Wealthfront Cash Account',
      account_type: 'cash',
      account_holder: this._parseHolder(text),
      account_number: this._parseAccountNumber(text),
      ...this._parsePeriod(text),
      ...this._parseBalances(text),
      transactions: this._parseTransactions(text),
      extraction_confidence: 0.99,
    };
  }

  private _parseInvestmentAccount(text: string): Record<string, unknown> {
    const period = this._parsePeriod(text);
    const endBal = text.match(/Ending(?:\s+Account)?\s+Value\s+\$?([\d,]+\.\d{2})/i);
    const begBal = text.match(/Beginning(?:\s+Account)?\s+Value\s+\$?([\d,]+\.\d{2})/i);
    return {
      doc_type: 'brokerage',
      institution: 'Wealthfront',
      account_name: 'Wealthfront Investment Account',
      account_type: 'investment',
      account_holder: this._parseHolder(text),
      account_number: this._parseAccountNumber(text),
      ...period,
      holdings: this._parseHoldings(text),
      total_value: endBal ? parseDollar(endBal[1]) : 0,
      beginning_value: begBal ? parseDollar(begBal[1]) : 0,
      cash: { settled_cash: 0, unsettled_cash: 0 },
      extraction_confidence: 0.99,
    };
  }

  // ── Field parsers ────────────────────────────────────────────────────────

  private _parseHolder(text: string): string {
    // Name is Title Case and followed by a street address line (number + street)
    const m = text.match(/\n([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\n\d+\s+/);
    return m ? m[1].trim() : '';
  }

  private _parseAccountNumber(text: string): string {
    const m = text.match(/(\d{4}-\d{4}-\d{4}-\d{2})/);
    return m ? m[1] : '';
  }

  private _parsePeriod(text: string): Record<string, unknown> {
    // "Feb. 13, 2026 to Mar. 12, 2026"
    const m = text.match(/(\w+\.?\s+\d{1,2},\s+\d{4})\s+to\s+(\w+\.?\s+\d{1,2},\s+\d{4})/i);
    if (m) {
      const start = parseDate(m[1]);
      const end   = parseDate(m[2]);
      return {
        statement_date: end,
        statement_period: { start_date: start, end_date: end },
      };
    }
    return { statement_date: '', statement_period: { start_date: '', end_date: '' } };
  }

  private _parseBalances(text: string): Record<string, unknown> {
    const beginning = text.match(/Beginning Balance\s+(?:on [^$]+)?\$?([\d,]+\.\d{2})/i);
    const ending    = text.match(/Ending Balance\s+(?:on [^$]+)?\$?([\d,]+\.\d{2})/i);
    const credits   = text.match(/Credits\s+\+\s+\$?([\d,]+\.\d{2})/i);
    const debits    = text.match(/Debits\s+-\s+\$?([\d,]+\.\d{2})/i);

    return {
      beginning_balance: beginning ? parseDollar(beginning[1]) : 0,
      ending_balance:    ending    ? parseDollar(ending[1])    : 0,
      credits:           credits   ? parseDollar(credits[1])   : 0,
      debits:            debits    ? parseDollar(debits[1])     : 0,
    };
  }

  private _parseHoldings(text: string): Holding[] {
    // "Symbol  Description  Quantity  Price  Market Value  % of Portfolio"
    const sIdx = text.search(/\bHoldings\b/i);
    if (sIdx === -1) return [];
    const section = text.slice(sIdx);
    const holdings: Holding[] = [];
    // Each data row: SYMBOL  DESCRIPTION  QTY  PRICE  MARKET_VALUE  PCT%
    const rowRe = /^([A-Z]{2,5})\s+(.+?)\s+([\d.]+)\s+\$([\d,]+\.\d{2})\s+\$([\d,]+\.\d{2})\s+([\d.]+)%/gm;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(section)) !== null) {
      holdings.push({
        symbol:       m[1],
        name:         m[2].trim(),
        asset_class:  'etf',
        quantity:     parseFloat(m[3]),
        price:        parseDollar(m[4]),
        market_value: parseDollar(m[5]),
        weight_pct:   parseFloat(m[6]) / 100,
      });
    }
    return holdings;
  }

  private _parseTransactions(text: string): Transaction[] {
    // Locate the TRANSACTIONS section (not SWEEP TRANSACTIONS)
    // Match "TRANSACTIONS" on its own line — excludes "SWEEP TRANSACTIONS 2"
    const txSectionMatch = text.match(/^TRANSACTIONS\s*$/im);
    if (!txSectionMatch) return [];

    const afterTx = text.slice(txSectionMatch.index! + txSectionMatch[0].length);

    // "No Transactions" → empty
    if (/No Transactions/i.test(afterTx.slice(0, 200))) return [];

    const sweepIdx = afterTx.search(/SWEEP TRANSACTIONS/i);
    const section  = sweepIdx > 0 ? afterTx.slice(0, sweepIdx) : afterTx;

    const txs: Transaction[] = [];
    // Lines: DATE  DESCRIPTION  AMOUNT
    const lineRe = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(-?[\d,]+\.\d{2})\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = lineRe.exec(section)) !== null) {
      txs.push({
        date:        parseDate(m[1]),
        description: m[2].trim(),
        merchant:    m[2].trim(),
        category:    inferCategory(m[2]),
        amount:      parseDollar(m[3]),
      });
    }
    return txs;
  }
}
