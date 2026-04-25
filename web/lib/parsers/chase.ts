import type { InstitutionParser, ParseResult, Transaction } from './types';
import { parseDollar, parseDate, inferCategory } from './utils';

export class ChaseParser implements InstitutionParser {
  readonly institution = 'Chase';
  readonly docType = 'bank' as const;

  detect(text: string): boolean {
    const head = text.slice(0, 600).toLowerCase();
    return (
      head.includes('jpmorgan chase') ||
      head.includes('chase total checking') ||
      head.includes('chase total savings') ||
      head.includes('chase.com')
    );
  }

  parse(text: string): ParseResult {
    try {
      const data = this._parse(text);
      return { success: true, data, confidence: 0.99, provider: 'dedicated_parser', model: 'chase-v1' };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Main ────────────────────────────────────────────────────────────────

  private _parse(text: string): Record<string, unknown> {
    const period   = this._parsePeriod(text);
    const balances = this._parseBalances(text);
    const txs      = this._parseTransactions(text, balances.beginning_balance as number);

    return {
      doc_type:          'bank',
      institution:       'Chase',
      account_name:      this._parseAccountName(text),
      account_type:      'checking',
      account_holder:    this._parseHolder(text),
      account_number:    this._parseAccountNumber(text),
      statement_date:    period.end_date,
      statement_period:  { start_date: period.start_date, end_date: period.end_date },
      ...balances,
      transactions:      txs,
      extraction_confidence: 0.99,
    };
  }

  // ── Field parsers ────────────────────────────────────────────────────────

  private _parseHolder(text: string): string {
    // Account holder name is in ALL CAPS at the address block
    const m = text.match(/\n([A-Z]{2,}(?:\s+[A-Z]{2,})+)\n/);
    return m ? m[1].trim() : '';
  }

  private _parseAccountNumber(text: string): string {
    // "Account Number:\n000000106569236" or "Account Number: 000000106569236"
    const m = text.match(/Account\s+Number[:\s]+\n?\s*(\d{6,})/i);
    return m ? m[1] : '';
  }

  private _parseAccountName(text: string): string {
    const m = text.match(/CHECKING SUMMARY\s+(Chase .+)/i) ||
              text.match(/Chase Total (Checking|Savings)/i);
    if (!m) return 'Chase Checking';
    return m[0].includes('CHECKING SUMMARY') ? m[1].trim() : `Chase Total ${m[1]}`;
  }

  private _parsePeriod(text: string): { start_date: string; end_date: string } {
    // "December 05, 2025 through January 07, 2026"
    const m = text.match(
      /(\w+\s+\d{1,2},\s+\d{4})\s+through\s+(\w+\s+\d{1,2},\s+\d{4})/i,
    );
    if (m) return { start_date: parseDate(m[1]), end_date: parseDate(m[2]) };
    return { start_date: '', end_date: '' };
  }

  private _parseBalances(text: string): Record<string, unknown> {
    // The summary section has "Beginning Balance $X,XXX.XX" and "Ending Balance $X,XXX.XX"
    // We want the FIRST occurrence of each (the CHECKING SUMMARY values, not repeated headers)
    const begMatch = text.match(/Beginning Balance\s+\$?([\d,]+\.\d{2})/i);
    const endMatch = text.match(/Ending Balance\s+\$?([\d,]+\.\d{2})/i);

    // Deposits and Electronic Withdrawals totals (for validation)
    const depMatch = text.match(/Deposits and Additions\s+([\d,]+\.\d{2})/i);
    const wdMatch  = text.match(/Electronic Withdrawals\s+(-?[\d,]+\.\d{2})/i);

    return {
      beginning_balance: begMatch ? parseDollar(begMatch[1]) : 0,
      ending_balance:    endMatch ? parseDollar(endMatch[1]) : 0,
      total_deposits:    depMatch ? parseDollar(depMatch[1]) : undefined,
      total_withdrawals: wdMatch  ? parseDollar(wdMatch[1])  : undefined,
    };
  }

  private _parseTransactions(text: string, beginningBalance: number): Transaction[] {
    // Locate "TRANSACTION DETAIL" section
    const sectionStart = text.search(/TRANSACTION DETAIL/i);
    if (sectionStart === -1) return [];

    // End at "IN CASE OF ERRORS" disclaimer or end of text
    const sectionEnd = text.search(/IN CASE OF ERRORS/i);
    const section = sectionEnd > sectionStart
      ? text.slice(sectionStart, sectionEnd)
      : text.slice(sectionStart);

    const txs: Transaction[] = [];
    let prevBalance = beginningBalance;

    // Each transaction row starts with MM/DD at the beginning of a line
    // Two formats:
    //   Credit: MM/DD  {desc}  {balance}                  (no amount shown)
    //   Debit:  MM/DD  {desc}  {negative_amount}  {balance}
    const lines = section.split('\n');
    let yearHint = '';

    // Extract year from a date we already parsed
    const yearMatch = text.match(/\d{4}/);
    if (yearMatch) yearHint = yearMatch[0];

    for (const raw of lines) {
      const line = raw.trim();

      // Must start with MM/DD date
      const dateMatch = line.match(/^(\d{2}\/\d{2})\s+/);
      if (!dateMatch) continue;

      // Skip the header row
      if (/DATE\s+DESCRIPTION/i.test(line)) continue;

      const afterDate = line.slice(dateMatch[0].length);

      // Find all dollar-amount-like numbers at the end of the line.
      // A number here is: optional minus, digits/commas, dot, two decimals.
      const numbersAtEnd: number[] = [];
      const numRe = /(-?[\d,]+\.\d{2})/g;
      let nm: RegExpExecArray | null;
      while ((nm = numRe.exec(afterDate)) !== null) {
        numbersAtEnd.push(parseDollar(nm[1]));
      }

      if (numbersAtEnd.length === 0) continue;

      let amount: number;
      let balance: number;

      if (numbersAtEnd.length === 1) {
        // Only a balance shown → credit; amount = balance - prevBalance
        balance = numbersAtEnd[0];
        amount  = parseFloat((balance - prevBalance).toFixed(2));
      } else {
        // Last number = balance, second-to-last = explicit amount
        balance = numbersAtEnd[numbersAtEnd.length - 1];
        amount  = numbersAtEnd[numbersAtEnd.length - 2];
      }

      // Description = everything between date and the first explicit amount
      const firstNumIdx = afterDate.search(/-?[\d,]+\.\d{2}/);
      const description = firstNumIdx > 0
        ? afterDate.slice(0, firstNumIdx).trim()
        : afterDate.trim();

      if (!description || description === 'Beginning Balance' || description === 'Ending Balance') {
        prevBalance = balance;
        continue;
      }

      txs.push({
        date:        parseDate(dateMatch[1], yearHint),
        description,
        merchant:    description,
        category:    inferCategory(description),
        amount,
      });

      prevBalance = balance;
    }

    return txs;
  }
}
