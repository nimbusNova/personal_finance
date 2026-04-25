/**
 * Diagnostic: run each parser against its real fixture file and print results.
 * Run: npx jest _diagnostic --verbose
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { RobinhoodParser }   from '../../lib/parsers/robinhood';
import { ChaseParser }       from '../../lib/parsers/chase';
import { SchwabParser }      from '../../lib/parsers/schwab';
import { WealthfrontParser } from '../../lib/parsers/wealthfront';

const FIXTURES_DIR = join(__dirname, '../fixtures');

function fixture(name: string) {
  return readFileSync(join(FIXTURES_DIR, `${name}_sample.txt`), 'utf8');
}

describe('Robinhood fixture diagnostic', () => {
  const parser = new RobinhoodParser();
  const result = parser.parse(fixture('robinhood'));
  const d = result.data as any;

  it('succeeds', () => expect(result.success).toBe(true));
  it('account_holder', () => { console.log('holder:', d?.account_holder); expect(d?.account_holder).toBeTruthy(); });
  it('account_number', () => { console.log('acct:', d?.account_number); expect(d?.account_number).toBeTruthy(); });
  it('statement_date', () => { console.log('date:', d?.statement_date); expect(d?.statement_date).toBeTruthy(); });
  it('total_value',    () => { console.log('total:', d?.total_value); expect(d?.total_value).toBeGreaterThan(0); });
  it('cash',          () => { console.log('cash:', d?.cash); expect((d?.cash as any)?.settled_cash).toBeGreaterThan(0); });
  it('holdings',      () => { console.log('holdings count:', d?.holdings?.length, d?.holdings?.slice(0,3).map((h:any) => h.symbol)); expect(d?.holdings?.length).toBeGreaterThan(0); });
  it('transactions',  () => { console.log('tx count:', d?.transactions?.length, d?.transactions?.slice(0,3).map((t:any) => `${t.date} ${t.amount}`)); expect(d?.transactions?.length).toBeGreaterThan(0); });
});

describe('Chase fixture diagnostic', () => {
  const parser = new ChaseParser();
  const result = parser.parse(fixture('chase'));
  const d = result.data as any;

  it('succeeds', () => expect(result.success).toBe(true));
  it('account_holder', () => { console.log('holder:', d?.account_holder); expect(d?.account_holder).toBeTruthy(); });
  it('account_number', () => { console.log('acct:', d?.account_number); expect(d?.account_number).toBeTruthy(); });
  it('statement_date', () => { console.log('date:', d?.statement_date); expect(d?.statement_date).toBeTruthy(); });
  it('beginning_balance', () => { console.log('beg:', d?.beginning_balance); expect(d?.beginning_balance).toBe(8274.63); });
  it('ending_balance',    () => { console.log('end:', d?.ending_balance); expect(d?.ending_balance).toBe(3843.03); });
  it('transactions', () => { console.log('tx count:', d?.transactions?.length, '\n', d?.transactions?.map((t:any) => `${t.date} ${t.amount} ${t.description?.slice(0,40)}`).join('\n')); expect(d?.transactions?.length).toBeGreaterThan(0); });
});

describe('Schwab fixture diagnostic', () => {
  const parser = new SchwabParser();
  const result = parser.parse(fixture('schwab'));
  const d = result.data as any;

  it('succeeds', () => expect(result.success).toBe(true));
  it('account_holder', () => { console.log('holder:', d?.account_holder); expect(d?.account_holder).toBeTruthy(); });
  it('account_number', () => { console.log('acct:', d?.account_number); expect(d?.account_number).toBeTruthy(); });
  it('statement_date', () => { console.log('date:', d?.statement_date); expect(d?.statement_date).toBeTruthy(); });
  it('total_value',    () => { console.log('total:', d?.total_value); expect(d?.total_value).toBeGreaterThan(0); });
  it('holdings',       () => { console.log('holdings count:', d?.holdings?.length, d?.holdings?.slice(0,3).map((h:any) => h.symbol)); expect(d?.holdings?.length).toBeGreaterThan(0); });
  it('transactions',   () => { console.log('tx count:', d?.transactions?.length); expect(d?.transactions?.length).toBeGreaterThanOrEqual(0); });
});

describe('Wealthfront fixture diagnostic', () => {
  const parser = new WealthfrontParser();
  const result = parser.parse(fixture('wealthfront'));
  const d = result.data as any;

  it('succeeds', () => expect(result.success).toBe(true));
  it('account_holder', () => { console.log('holder:', d?.account_holder); expect(d?.account_holder).toBeTruthy(); });
  it('account_number', () => { console.log('acct:', d?.account_number); expect(d?.account_number).toBeTruthy(); });
  it('statement_date', () => { console.log('date:', d?.statement_date); expect(d?.statement_date).toBeTruthy(); });
  it('beginning_balance', () => { console.log('beg:', d?.beginning_balance); expect(d?.beginning_balance).toBeGreaterThan(0); });
  it('ending_balance',    () => { console.log('end:', d?.ending_balance); expect(d?.ending_balance).toBeGreaterThan(0); });
  it('transactions',  () => { console.log('tx count:', d?.transactions?.length); expect(Array.isArray(d?.transactions)).toBe(true); });
});
