import type { InstitutionParser, ParseResult, Holding, Transaction } from './types';
import { parseDollar, parseDate, stripAnnotations, extractSection } from './utils';

export class SchwabParser implements InstitutionParser {
  readonly institution = 'Charles Schwab';
  readonly docType = 'brokerage' as const;

  detect(text: string): boolean {
    const head = text.slice(0, 1000).toLowerCase();
    return (
      (head.includes('charles') && head.includes('schwab')) ||
      head.includes('schwab one') ||
      head.includes('schwab.com')
    );
  }

  parse(text: string): ParseResult {
    try {
      const data = this._parse(text);
      return { success: true, data, confidence: 0.99, provider: 'dedicated_parser', model: 'schwab-v1' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Main ────────────────────────────────────────────────────────────────

  private _parse(text: string): Record<string, unknown> {
    const holdings = [
      ...this._parsePositionSection(text, 'Positions - Equities', 'equity'),
      ...this._parsePositionSection(text, 'Positions - Exchange Traded Funds', 'etf'),
      ...this._parsePositionSection(text, 'Positions - Other Assets', 'reit'),
    ];

    const cash       = this._parseCash(text);
    const totalValue = this._parseTotalValue(text);
    const period     = this._parsePeriod(text);
    const summary    = this._parseSummaryTable(text);

    return {
      doc_type:              'brokerage',
      institution:           'Charles Schwab',
      account_type:          'Schwab One Brokerage',
      account_holder:        this._parseHolder(text),
      account_number:        this._parseAccountNumber(text),
      statement_date:        period.end_date,
      statement_period:      { start_date: period.start_date, end_date: period.end_date },
      holdings,
      cash,
      total_value:           totalValue,
      ...summary,
      transactions:          this._parseTransactions(text, period.end_date),
      extraction_confidence: 0.99,
    };
  }

  // ── Header / account info ────────────────────────────────────────────────

  private _parseHolder(text: string): string {
    // "Schwab One® Account of\n\nMICHAEL WU"
    const m = text.match(/Schwab One[®®]?\s+Account\s+of\s+\n+([^\n]+)/i);
    if (m) return m[1].trim();
    // Fallback: first ALL-CAPS name line
    const m2 = text.match(/^([A-Z]{2,}(?:\s+[A-Z]{2,})+)$/m);
    return m2 ? m2[1].trim() : '';
  }

  private _parseAccountNumber(text: string): string {
    // "7406-8532" or masked "****-*532"
    const m = text.match(/Account\s+Number\s+(\d{4}-\d{4}|\*{4}-\*\d{3,4})/i);
    return m ? m[1] : '';
  }

  private _parsePeriod(text: string): { start_date: string; end_date: string } {
    // "March 1-31, 2026"
    const m = text.match(/Statement\s+Period\s+\n?([A-Za-z]+ \d+-\d+,\s+\d{4})/i);
    if (m) {
      const range = m[1].match(/^(\w+)\s+(\d+)-(\d+),\s+(\d{4})$/i);
      if (range) {
        const MONTHS: Record<string, string> = {
          january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
          july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
        };
        const mon = MONTHS[range[1].toLowerCase()] || '01';
        return {
          start_date: `${range[4]}-${mon}-${range[2].padStart(2, '0')}`,
          end_date:   `${range[4]}-${mon}-${range[3].padStart(2, '0')}`,
        };
      }
    }
    return { start_date: '', end_date: '' };
  }

  // ── Account summary ──────────────────────────────────────────────────────

  private _parseTotalValue(text: string): number {
    const m = text.match(/Ending Account Value\s+\$?([\d,]+\.\d{2})/i);
    return m ? parseDollar(m[1]) : 0;
  }

  private _parseCash(text: string): { settled_cash: number; unsettled_cash: number } {
    // "Cash and Cash Investments" section — look for Ending Balance column
    const section = extractSection(text, /Cash and Cash Investments/i, /Positions|Total Cash/i);
    const endBal  = section.match(/Cash\s+[\d.]*\s+([\d,]+\.\d{2})/);
    const pending  = text.match(/Pending\s*\/\s*Unsettled\s+Cash\s*\(?\$?\)?\s*([\d,]+\.\d{2})/i);
    return {
      settled_cash:   endBal  ? parseDollar(endBal[1])  : 0,
      unsettled_cash: pending ? parseDollar(pending[1]) : 0,
    };
  }

  private _parseSummaryTable(text: string): Record<string, unknown> {
    const deps  = text.match(/^Deposits\s+([\d,]+\.\d{2})/im);
    const wds   = text.match(/^Withdrawals\s+([\d,]+\.\d{2})/im);
    const divs  = text.match(/Dividends\s+and\s+Interest\s+([\d,]+\.\d{2})/i);
    const apprc = text.match(/Market\s+Appreciation\s*\/\s*\(Depreciation\)\s+(\([\d,]+\.\d{2}\)|[\d,]+\.\d{2})/i);
    const unrl  = text.match(/Unrealized\s+\$?([\d,]+\.\d{2})/i);

    return {
      deposits:              deps  ? parseDollar(deps[1])  : 0,
      withdrawals:           wds   ? parseDollar(wds[1])   : 0,
      dividends_and_interest:divs  ? parseDollar(divs[1])  : 0,
      market_change:         apprc ? parseDollar(apprc[1]) : 0,
      unrealized_gain_loss:  unrl  ? parseDollar(unrl[1])  : undefined,
    };
  }

  // ── Holdings ─────────────────────────────────────────────────────────────

  /**
   * Parse a "Positions - Equities" / "- Exchange Traded Funds" / "- Other Assets" block.
   *
   * Each data row looks like (after annotation stripping):
   *   SYMBOL  DESCRIPTION  QUANTITY  PRICE  MARKET_VALUE  COST_BASIS  UNREALIZED  YIELD  EST_INCOME  PCT
   *
   * The header row contains: Symbol  Description  Quantity  Price($)  Market Value($) ...
   * We skip lines that are part of the header or the "Total" footer.
   */
  private _parsePositionSection(text: string, header: string, assetClass: string): Holding[] {
    // Find section start
    const sIdx = text.indexOf(header);
    if (sIdx === -1) return [];

    // Find section end (next "Positions -" or "Transaction" or "Gain or" block)
    const after      = text.slice(sIdx + header.length);
    const endPattern = /Positions\s+-|Transaction\s+Detail|Gain\s+or|Total\s+\w+\s+Funds/i;
    const endMatch   = endPattern.exec(after);
    const section    = endMatch ? after.slice(0, endMatch.index) : after;

    const holdings: Holding[] = [];

    // Split into lines, strip annotation tokens
    const lines = section.split('\n').map(l => stripAnnotations(l));

    for (const line of lines) {
      if (!line.trim()) continue;

      // Skip header / total / disclaimer lines
      if (/^Symbol\s+Description|^Total\s+|^Values\s+may|Estimated\s+Annual|^REIT$/i.test(line)) continue;

      // A data line starts with a 1–5 char ticker, e.g. "GOOGL ALPHABET INC 0.0771 287.56 22.17 ..."
      const tickerMatch = line.match(/^([A-Z]{1,5})\s+(.+?)\s+([\d]+\.[\d]+)\s+([\d]+\.[\d]+)\s+([\d,]+\.[\d]+)\s+([\d,]+\.[\d]+)\s+(-?[\d,]+\.[\d]+|\([\d,]+\.[\d]+\))/);
      if (!tickerMatch) continue;

      const symbol     = tickerMatch[1];
      const rawName    = tickerMatch[2];
      const quantity   = parseFloat(tickerMatch[3]) || 0;
      const price      = parseFloat(tickerMatch[4]) || 0;
      const mktVal     = parseDollar(tickerMatch[5]);
      const costBasis  = parseDollar(tickerMatch[6]);
      const unrealized = parseDollar(tickerMatch[7]);

      // Est. yield — optional; may be "N/A" or "<1%"
      const yieldMatch = line.match(/(\d+\.\d+%|N\/A)\s+/g);
      const weightMatch= line.match(/<?\d+%\s*$/);

      holdings.push({
        symbol,
        name:          rawName.trim(),
        asset_class:   assetClass,
        quantity,
        price,
        market_value:  mktVal,
        cost_basis:    costBasis,
        unrealized_pnl: unrealized,
        weight_pct:    weightMatch
          ? parseFloat(weightMatch[0].replace(/[<%\s]/g, '')) / 100
          : undefined,
      });
    }

    return holdings;
  }

  // ── Transactions ─────────────────────────────────────────────────────────

  private _parseTransactions(text: string, statementDate: string): Transaction[] {
    const sIdx = text.search(/Transaction\s+Details?/i);
    if (sIdx === -1) return [];

    const after    = text.slice(sIdx);
    const endMatch = /Pending\s*\/\s*Open\s+Activity|Total\s+Transactions|Endnotes/i.exec(after);
    const section  = endMatch ? after.slice(0, endMatch.index) : after;

    const txs: Transaction[] = [];

    // Extract year from statementDate for short MM/DD date parsing
    const year = statementDate ? statementDate.slice(0, 4) : new Date().getFullYear().toString();

    // Each transaction line begins with a date MM/DD, then category, action, symbol, description, qty, price, amount
    // e.g.: "03/02 Purchase Reinvested Shares ETR ENTERGY CORP NEW 0.0036 107.1229 (0.39)"
    const lineRe = /^(\d{2}\/\d{2})\s+(Purchase|Dividend|Deposit|Withdrawal|Redemption|Sale|Transfer)\s+(.+?)\s+(-?[\d,]+\.\d{2}|\([\d,]+\.\d{2}\))\s*$/gm;
    let m: RegExpExecArray | null;

    while ((m = lineRe.exec(section)) !== null) {
      const amount = parseDollar(m[4]);
      if (amount === 0) continue;

      const descRaw = m[3].trim();
      // Description contains: action + symbol/CUSIP + security name + quantity + price
      // The security description comes after the action keyword
      const actionWords = m[2]; // e.g. "Purchase"
      const category =
        actionWords === 'Dividend'   ? 'Income'     :
        actionWords === 'Deposit'    ? 'Transfer'   :
        actionWords === 'Withdrawal' ? 'Transfer'   :
        'Trade';

      txs.push({
        date:        parseDate(m[1], year),
        description: descRaw,
        merchant:    descRaw,
        category,
        amount,
      });
    }

    return txs;
  }
}
