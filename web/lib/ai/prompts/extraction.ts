export const BROKERAGE_EXTRACTION_PROMPT = `Extract all holdings and account data from this brokerage statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "brokerage"
- institution: string
- account_type: string
- statement_date: YYYY-MM-DD
- holdings: array of objects with symbol, name, asset_class, sector, geography, quantity, price, market_value, cost_basis
- cash: object with settled_cash, unsettled_cash
- total_value: number
- other_assets: number (optional — any value not accounted for by holdings + cash, e.g. margin, pending dividends, accrued interest)
- extraction_confidence: number 0-1

IMPORTANT: Include EVERY position shown in the statement, including money market funds, cash sweep positions (e.g. SPAXX, FZFXX, SWVXX), and any listed securities. Do not skip cash-equivalent positions.

Return only the JSON object, no markdown, no explanation.`;

export const HOLDINGS_LIST_PROMPT = `Extract the holdings table from this brokerage statement.

Return ONLY a valid JSON object with these exact fields:
- holdings: array of objects with symbol, name, asset_class, sector, geography, quantity, price, market_value, cost_basis
- extraction_confidence: number 0-1

Be concise. Include EVERY position shown in the statement, including money market funds, cash sweep positions (e.g. SPAXX, FZFXX, SWVXX), and any listed securities. Do not skip cash-equivalent positions.
Return only the JSON object, no markdown, no explanation.`;

export const ACCOUNT_METADATA_PROMPT = `Extract the account summary from this brokerage statement.

Return ONLY a valid JSON object with these exact fields:
- account_type: string
- statement_date: YYYY-MM-DD
- cash: object with settled_cash, unsettled_cash
- total_value: number
- extraction_confidence: number 0-1

Return only the JSON object, no markdown, no explanation.`;

export const BANK_EXTRACTION_PROMPT = `Extract all transactions and balances from this bank statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "bank"
- institution: string
- account_name: string
- account_type: string
- statement_date: YYYY-MM-DD
- statement_period: object with start_date and end_date
- beginning_balance: number
- ending_balance: number
- transactions: array of objects with date, description, amount, category, is_recurring
- extraction_confidence: number 0-1

For category, choose from: Food & Dining, Groceries, Shopping, Entertainment, Transportation, Healthcare, Travel, Utilities, Subscriptions, Education, Fitness, Personal Care, Home Improvement, Fees & Charges, Income, Other.
If the statement does not show a category, infer it from the merchant/description name. Never return null for category.
Examples: Starbucks/restaurants → Food & Dining; Target/Walmart/grocery → Groceries; Amazon/Best Buy → Shopping; gas/Uber → Transportation; CVS/doctors → Healthcare; Netflix/Spotify → Subscriptions; gym → Fitness.

If there are no transactions, return an empty array [].
Return only the JSON object, no markdown, no explanation.`;

export const CREDIT_CARD_EXTRACTION_PROMPT = `Extract all transactions and statement balance from this credit card statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "credit_card"
- institution: string
- account_name: string
- statement_date: YYYY-MM-DD
- statement_balance: number
- transactions: array of objects with date, merchant, category, amount, is_recurring
- extraction_confidence: number 0-1

For category, choose from: Food & Dining, Groceries, Shopping, Entertainment, Transportation, Healthcare, Travel, Utilities, Subscriptions, Education, Fitness, Personal Care, Home Improvement, Fees & Charges, Income, Other.
If the statement does not show a category, infer it from the merchant name. Never return null for category.
Examples: Starbucks/restaurants → Food & Dining; Target/Walmart/grocery → Groceries; Amazon/Best Buy → Shopping; gas/Uber → Transportation; CVS/doctors → Healthcare; Netflix/Spotify → Subscriptions; gym → Fitness.

Return only the JSON object, no markdown, no explanation.`;

export const JSON_REPAIR_PROMPT = `The text below was supposed to be valid JSON but failed to parse.
Fix any syntax errors, remove any non-JSON text, and return ONLY valid JSON.
IMPORTANT: remove trailing commas (commas before closing } or ]). This is the most common error.
Do not add explanations, markdown, or commentary.

Broken JSON:
`;

// ── Helper: build prompt with year hint and truncation ──

const MAX_CHARS = 80000;

export function buildExtractionPrompt(
  systemPrompt: string,
  pdfText: string,
  statementDate?: string
): { system: string; prompt: string } {
  const text = pdfText.length > MAX_CHARS ? pdfText.slice(0, MAX_CHARS) + '\n...[truncated]' : pdfText;
  const yearHint = statementDate
    ? `\n\nIMPORTANT: Transaction dates in this statement may only show month and day (e.g. "03/28" or "Apr 5"). Look at the entire PDF for year clues — statement date, billing cycle, year-to-date summaries, or headers — and use the correct year for ALL dates. This statement is dated ${statementDate}.`
    : '';

  return {
    system: systemPrompt + yearHint,
    prompt: `Below is the extracted text from a financial statement PDF.\n\n--- PDF TEXT START ---\n${text}\n--- PDF TEXT END ---`,
  };
}
