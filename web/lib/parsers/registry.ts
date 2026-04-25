import type { InstitutionParser } from './types';
import { RobinhoodParser }   from './robinhood';
import { WealthfrontParser } from './wealthfront';
import { SchwabParser }      from './schwab';
import { ChaseParser }       from './chase';

const PARSERS: InstitutionParser[] = [
  new RobinhoodParser(),
  new WealthfrontParser(),
  new SchwabParser(),
  new ChaseParser(),
];

/**
 * Return the first parser whose detect() passes and whose layout validates,
 * or null to fall back to AI. Logs a warning if a known institution's layout
 * doesn't match the expected format (format drift / version mismatch).
 */
export function findParser(text: string): InstitutionParser | null {
  for (const parser of PARSERS) {
    if (!parser.detect(text)) continue;
    try {
      parser.validateLayout(text);
      return parser;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[parser] ${parser.institution} detected but layout mismatch (${parser.parserVersion}): ${msg} — falling back to AI`,
      );
      return null;
    }
  }
  return null;
}

/**
 * Run a parser and emit metrics: institution, duration, holdings/transaction counts.
 * Returns the same ParseResult the parser would return directly.
 */
export function runParser(parser: InstitutionParser, text: string) {
  const start = Date.now();
  const result = parser.parse(text);
  const ms = Date.now() - start;
  const d = result.data as Record<string, unknown> | undefined;
  const holdingsCount = Array.isArray(d?.holdings) ? (d!.holdings as unknown[]).length : 0;
  const txCount = Array.isArray(d?.transactions) ? (d!.transactions as unknown[]).length : 0;
  console.info(
    `[parser] ${parser.institution} (${parser.parserVersion}) parsed in ${ms}ms — holdings:${holdingsCount} transactions:${txCount}`,
  );
  return result;
}
