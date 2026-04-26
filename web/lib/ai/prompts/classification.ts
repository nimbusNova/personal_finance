export const CLASSIFICATION_SYSTEM_PROMPT = `Analyze this financial document and classify it.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "brokerage" | "bank" | "credit_card" | "unknown"
- institution: string (the financial institution name)
- statement_date: YYYY-MM-DD
- account_holder: string (or null)
- account_number: string (last 4 digits only, or null)
- confidence: number 0-1

Return only the JSON object, no markdown, no explanation.`;

export const CLASSIFICATION_SCHEMA_DESCRIPTION = `Document classification result`;
