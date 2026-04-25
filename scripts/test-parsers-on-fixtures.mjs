#!/usr/bin/env node
/**
 * Run each parser against its real fixture and report what was extracted.
 * Run from project root: node scripts/test-parsers-on-fixtures.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(import.meta.url);

// Load parser classes via CJS require (they're TypeScript, so we need ts-node or compiled output)
// Instead, inline minimal versions here for diagnostics using the compiled output if available.
// Actually let's use ts-node.

// We'll write a mini runner that calls the parsers via tsx
import { execSync } from 'child_process';

const script = `
const { readFileSync } = require('fs');
const { RobinhoodParser } = require('./web/lib/parsers/robinhood');
const { ChaseParser } = require('./web/lib/parsers/chase');
const { SchwabParser } = require('./web/lib/parsers/schwab');
const { WealthfrontParser } = require('./web/lib/parsers/wealthfront');

const FIXTURES = [
  { name: 'Robinhood',   Parser: RobinhoodParser,   file: 'web/__tests__/fixtures/robinhood_sample.txt' },
  { name: 'Chase',       Parser: ChaseParser,        file: 'web/__tests__/fixtures/chase_sample.txt' },
  { name: 'Schwab',      Parser: SchwabParser,       file: 'web/__tests__/fixtures/schwab_sample.txt' },
  { name: 'Wealthfront', Parser: WealthfrontParser,  file: 'web/__tests__/fixtures/wealthfront_sample.txt' },
];

for (const { name, Parser, file } of FIXTURES) {
  const text = readFileSync(file, 'utf8');
  const parser = new Parser();
  const result = parser.parse(text);
  console.log('\\n' + '='.repeat(60));
  console.log('PARSER: ' + name);
  console.log('success:', result.success);
  if (!result.success) { console.log('error:', result.error); continue; }
  const d = result.data;
  console.log('account_holder:', d.account_holder);
  console.log('account_number:', d.account_number);
  console.log('statement_date:', d.statement_date);
  if (d.holdings) console.log('holdings count:', d.holdings.length, d.holdings.slice(0,3).map(h => h.symbol + ' qty=' + h.quantity + ' val=' + h.market_value));
  if (d.transactions) console.log('transactions count:', d.transactions.length, d.transactions.slice(0,3).map(t => t.date + ' ' + t.description?.slice(0,30) + ' amt=' + t.amount));
  if (d.beginning_balance !== undefined) console.log('beginning_balance:', d.beginning_balance);
  if (d.ending_balance !== undefined) console.log('ending_balance:', d.ending_balance);
  if (d.total_value !== undefined) console.log('total_value:', d.total_value);
  if (d.cash) console.log('cash:', d.cash);
}
`;

try {
  const out = execSync(
    `cd ${root} && npx tsx --tsconfig web/tsconfig.json -e '${script.replace(/'/g, "\\'")}'`,
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  );
  console.log(out);
} catch (e) {
  console.error(e.stdout);
  console.error(e.stderr);
}
