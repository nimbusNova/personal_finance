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

/** Return the first parser whose detect() passes, or null to fall back to AI. */
export function findParser(text: string): InstitutionParser | null {
  return PARSERS.find(p => p.detect(text)) ?? null;
}
