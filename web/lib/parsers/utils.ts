const MONTH_MAP: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** "$1,234.56" | "($38.00)" | "1234.56" → number */
export function parseDollar(s: string): number {
  if (!s) return 0;
  const t = s.trim().replace(/[$,\s]/g, '');
  if (t.startsWith('(') && t.endsWith(')')) return -(parseFloat(t.slice(1, -1)) || 0);
  return parseFloat(t) || 0;
}

/** "-1,944.76" | "4,618.89" → signed number */
export function parseAmount(s: string): number {
  if (!s) return 0;
  return parseFloat(s.trim().replace(/[,$\s]/g, '')) || 0;
}

/**
 * Normalise various date strings to ISO YYYY-MM-DD.
 *  "03/02/2026"          → "2026-03-02"
 *  "03/02" + year "2026" → "2026-03-02"
 *  "March 1-31, 2026"   → end date "2026-03-31"
 *  "Mar. 12, 2026"       → "2026-03-12"
 *  "December 05, 2025"   → "2025-12-05"
 */
export function parseDate(s: string, yearHint?: string): string {
  const t = s.trim();

  // MM/DD/YYYY
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`;

  // MM/DD with year hint
  const md = t.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (md && yearHint) return `${yearHint}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}`;

  // "Month D-DD, YYYY" (Schwab range — return end day)
  const range = t.match(/^(\w+)\s+(\d{1,2})-(\d{1,2}),\s+(\d{4})$/i);
  if (range) {
    const mon = MONTH_MAP[range[1].toLowerCase()];
    if (mon) return `${range[4]}-${mon}-${range[3].padStart(2, '0')}`;
  }

  // "Month DD, YYYY" or "Mon. DD, YYYY"
  const long = t.match(/^(\w+)\.?\s+(\d{1,2}),\s+(\d{4})$/i);
  if (long) {
    const mon = MONTH_MAP[long[1].toLowerCase()];
    if (mon) return `${long[3]}-${mon}-${long[2].padStart(2, '0')}`;
  }

  // "Month D, YYYY" (no leading zero needed)
  const long2 = t.match(/^(\w+)\s+(\d{1,2})\s+(\d{4})$/i);
  if (long2) {
    const mon = MONTH_MAP[long2[1].toLowerCase()];
    if (mon) return `${long2[3]}-${mon}-${long2[2].padStart(2, '0')}`;
  }

  return t; // pass through unchanged if nothing matches
}

/** "March 1-31, 2026" → { start: "2026-03-01", end: "2026-03-31" } */
export function parseDateRange(s: string): { start: string; end: string } | null {
  const t = s.trim();

  // "Month D-DD, YYYY"
  const schwab = t.match(/^(\w+)\s+(\d{1,2})-(\d{1,2}),\s+(\d{4})$/i);
  if (schwab) {
    const mon = MONTH_MAP[schwab[1].toLowerCase()];
    if (mon) {
      return {
        start: `${schwab[4]}-${mon}-${schwab[2].padStart(2, '0')}`,
        end:   `${schwab[4]}-${mon}-${schwab[3].padStart(2, '0')}`,
      };
    }
  }

  // "Month DD, YYYY through Month DD, YYYY"  (Chase)
  const chase = t.match(/^(\w+ \d+, \d{4})\s+through\s+(\w+ \d+, \d{4})$/i);
  if (chase) return { start: parseDate(chase[1]), end: parseDate(chase[2]) };

  // "Mon. DD, YYYY to Mon. DD, YYYY"  (Wealthfront)
  const wf = t.match(/^(.+?)\s+to\s+(.+)$/i);
  if (wf) return { start: parseDate(wf[1]), end: parseDate(wf[2]) };

  // "MM/DD/YYYY to MM/DD/YYYY"  (Robinhood)
  const rh = t.match(/^(\d{2}\/\d{2}\/\d{4})\s+to\s+(\d{2}\/\d{2}\/\d{4})$/);
  if (rh) return { start: parseDate(rh[1]), end: parseDate(rh[2]) };

  return null;
}

/** Strip (M),◊ annotation tokens Schwab appends to security descriptions */
export function stripAnnotations(s: string): string {
  return s
    .replace(/\(M\)/g, '')
    .replace(/,◊/g, '')
    .replace(/◊/g, '')
    .replace(/,\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Return the substring of `text` between the first match of `startPattern`
 * (exclusive) and the first subsequent match of `endPattern` (exclusive).
 * Returns the rest of the string if `endPattern` never matches.
 */
export function extractSection(
  text: string,
  startPattern: RegExp,
  endPattern: RegExp,
): string {
  const sm = startPattern.exec(text);
  if (!sm) return '';
  const rest = text.slice(sm.index + sm[0].length);
  const em = endPattern.exec(rest);
  return em ? rest.slice(0, em.index) : rest;
}

/** Infer a simple spending category from a free-text merchant / description */
export function inferCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (/payroll|salary|wages|direct.?dep/i.test(d)) return 'Income';
  if (/zelle.payment.from|venmo.from|transfer.in/i.test(d)) return 'Transfer In';
  if (/zelle.payment.to|venmo.to|transfer.out/i.test(d)) return 'Transfer Out';
  if (/robinhood|schwab|wealthfront|fidelity|vanguard|brokerage|moneylink/i.test(d)) return 'Brokerage Transfer';
  if (/mortgage|rent|hoa|lease/i.test(d)) return 'Housing';
  if (/chase.card|credit.card|card.payment/i.test(d)) return 'Credit Card Payment';
  if (/t-mobile|at&t|verizon|sprint|pcs.svc/i.test(d)) return 'Subscriptions';
  if (/pg&?e|electric|gas|water|utility|pgande/i.test(d)) return 'Utilities';
  if (/starbucks|mcdonald|restaurant|cafe|doordash|grubhub|uber.eats/i.test(d)) return 'Food & Dining';
  if (/grocery|safeway|trader|whole.food|kroger|costco/i.test(d)) return 'Groceries';
  if (/amazon|walmart|target|best.buy|shopping/i.test(d)) return 'Shopping';
  if (/uber|lyft|gas|fuel|parking|transit/i.test(d)) return 'Transportation';
  if (/netflix|spotify|hulu|disney|apple.tv|subscription/i.test(d)) return 'Subscriptions';
  if (/gym|fitness|planet/i.test(d)) return 'Fitness';
  if (/cvs|walgreen|pharmacy|doctor|medical|dental/i.test(d)) return 'Healthcare';
  return 'Other';
}
