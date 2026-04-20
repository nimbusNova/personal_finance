import { readFileSync } from 'fs';
import { basename } from 'path';
import { getKimiApiKey, getKimiBaseUrl } from './settings';
import { createServerLogger } from '../server-logger';

const log = createServerLogger('kimi');

const KIMI_MODEL = process.env.KIMI_MODEL || 'moonshot-v1-128k';

const CLASSIFICATION_PROMPT = `Analyze this financial document and classify it.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "brokerage" | "bank" | "credit_card" | "unknown"
- institution: string (the financial institution name)
- statement_date: YYYY-MM-DD
- account_holder: string (or null)
- account_number: string (last 4 digits only, or null)
- confidence: number 0-1

Return only the JSON object, no markdown, no explanation.`;

const BROKERAGE_EXTRACTION_PROMPT = `Extract all holdings and account data from this brokerage statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "brokerage"
- institution: string
- account_type: string
- statement_date: YYYY-MM-DD
- holdings: array of objects with symbol, name, asset_class, sector, geography, quantity, price, market_value, cost_basis
- cash: object with settled_cash, unsettled_cash
- total_value: number
- extraction_confidence: number 0-1

Return only the JSON object, no markdown, no explanation.`;

const BANK_EXTRACTION_PROMPT = `Extract all transactions and balances from this bank statement.

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

If there are no transactions, return an empty array [].
Return only the JSON object, no markdown, no explanation.`;

const CREDIT_CARD_EXTRACTION_PROMPT = `Extract all transactions and statement balance from this credit card statement.

Return ONLY a valid JSON object with these exact fields:
- doc_type: "credit_card"
- institution: string
- account_name: string
- statement_date: YYYY-MM-DD
- statement_balance: number
- transactions: array of objects with date, merchant, category, amount, is_recurring
- extraction_confidence: number 0-1

Return only the JSON object, no markdown, no explanation.`;

const JSON_REPAIR_PROMPT = `The text below was supposed to be valid JSON but failed to parse.
Fix any syntax errors, remove any non-JSON text, and return ONLY valid JSON.
IMPORTANT: remove trailing commas (commas before closing } or ]). This is the most common error.
Do not add explanations, markdown, or commentary.

Broken JSON:
`;

/**
 * Fix common AI-generated JSON syntax errors before parsing.
 * Primary fix: trailing commas (e.g. { "a": 1, } → { "a": 1 })
 */
function sanitizeJson(text: string): string {
  // Remove trailing commas before } or ] — the #1 cause of AI JSON parse failures
  return text.replace(/,\s*([\}\]])/g, '$1');
}

function extractErrorContext(text: string, errorMessage: string): string {
  const match = errorMessage.match(/position\s+(\d+)/i);
  if (!match) return text.slice(0, 500);
  const pos = parseInt(match[1], 10);
  const start = Math.max(0, pos - 200);
  const end = Math.min(text.length, pos + 200);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}\n\n^^^^ ERROR AROUND POSITION ${pos} ^^^^`;
}

export interface KimiResult {
  success: boolean;
  data?: any;
  error?: string;
  raw_response?: string;
  confidence?: number;
  model?: string;
  usage?: any;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(status: number, body: string): boolean {
  if (status >= 500) return true;
  if (status !== 429) return false;
  // Moonshot 429 can mean rate limit (don't retry) or engine overloaded (retry)
  try {
    const parsed = JSON.parse(body);
    const type = parsed?.error?.type || '';
    return type === 'engine_overloaded_error';
  } catch {
    // If we can't parse, be conservative and retry on 429
    return true;
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  uploadId?: number,
  maxRetries = 4,
  timeoutMs = 120000
): Promise<Response> {
  let lastError = '';
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const start = Date.now();
      log.info(`Sending request for upload=${uploadId}, attempt=${attempt}, timeout=${timeoutMs}ms`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);

      const elapsed = Date.now() - start;
      log.info(`Response received for upload=${uploadId} in ${elapsed}ms, status=${response.status}`);

      if (response.ok) {
        if (attempt > 0) {
          log.info(`Request succeeded for upload=${uploadId} after ${attempt} retry(s)`);
        }
        return response;
      }

      const errText = await response.text();
      lastError = `HTTP ${response.status}: ${errText.slice(0, 500)}`;

      if (!isRetryableError(response.status, errText)) {
        // Non-retryable error — fail immediately
        throw new Error(lastError);
      }

      if (attempt < maxRetries) {
        const delay = 2000 * 2 ** attempt + Math.random() * 1000;
        log.info(
          `Retry ${attempt + 1}/${maxRetries} for upload=${uploadId}, waiting ${(delay / 1000).toFixed(1)}s (${lastError.slice(0, 120)})`
        );
        await sleep(delay);
      }
    } catch (exc: any) {
      if (exc.name === 'AbortError') {
        lastError = `Request timed out after ${timeoutMs}ms`;
        log.error(`Timeout for upload=${uploadId}: ${lastError}`);
      }
      // Network-level errors (fetch threw) — retry those too
      if (attempt < maxRetries) {
        const delay = 2000 * 2 ** attempt + Math.random() * 1000;
        log.info(
          `Retry ${attempt + 1}/${maxRetries} for upload=${uploadId}, waiting ${(delay / 1000).toFixed(1)}s (network: ${exc.message})`
        );
        await sleep(delay);
      } else {
        throw exc;
      }
    }
  }
  throw new Error(lastError || 'Max retries exceeded');
}

class KimiService {
  apiKey: string;
  baseUrl: string;
  model: string;

  constructor() {
    this.apiKey = getKimiApiKey();
    this.baseUrl = getKimiBaseUrl();
    this.model = KIMI_MODEL;
    log.info(`Initialized: base_url=${this.baseUrl}, model=${this.model}, key_set=${this.apiKey ? 'yes' : 'no'}`);
  }

  async extractFromPdf(filePath: string, uploadId?: number, onProgress?: (step: string) => void): Promise<KimiResult> {
    onProgress?.('reading_pdf');
    onProgress?.('reading_pdf');
    const { text: pdfText, source: textSource } = await this._getPdfText(filePath, uploadId);
    log.debug(`PDF text source=${textSource}, length=${pdfText?.length || 0}`, pdfText?.slice(0, 500));
    if (!pdfText) return { success: false, error: 'Could not extract text from PDF' };

    onProgress?.('classifying');
    const classification = await this.classifyDocument(pdfText, uploadId);
    if (!classification.success) {
      log.error(`Classification failed for upload=${uploadId}: ${classification.error}`, classification.raw_response);
      return { success: false, error: `Classification failed: ${classification.error}`, raw_response: classification.raw_response };
    }
    log.debug(`Classification result: doc_type=${classification.data?.doc_type}, institution=${classification.data?.institution}, confidence=${classification.data?.confidence}`);

    const docType = classification.data?.doc_type || 'unknown';
    const institution = classification.data?.institution || 'Unknown';
    const statementDate = classification.data?.statement_date;

    onProgress?.('extracting');
    const extraction = await this.extractStructuredData(pdfText, docType, uploadId);
    if (extraction.success) {
      const data = extraction.data || {};
      data.doc_type = data.doc_type || docType;
      data.institution = data.institution || institution;
      data.statement_date = data.statement_date || statementDate;
      data.classification = classification.data;
      log.debug(`Extraction success: model=${extraction.model}, usage=${JSON.stringify(extraction.usage)}, confidence=${extraction.confidence}`);
      return { success: true, data, raw_response: extraction.raw_response };
    }
    log.warn(`Extraction failed for upload=${uploadId}: ${extraction.error}`, extraction.raw_response);

    const raw = extraction.raw_response;
    if (raw) {
      onProgress?.('repairing_json');
      const repair = await this.repairJson(raw, uploadId);
      if (repair.success) {
        const data = repair.data || {};
        data.doc_type = data.doc_type || docType;
        data.institution = data.institution || institution;
        data.statement_date = data.statement_date || statementDate;
        data.classification = classification.data;
        log.info(`JSON repair succeeded for upload=${uploadId}`);
        return { success: true, data, raw_response: repair.raw_response };
      }
      log.error(`JSON repair failed for upload=${uploadId}: ${repair.error}`, repair.raw_response);
    }

    return { success: false, error: `All extraction stages failed. Last error: ${extraction.error}`, raw_response: extraction.raw_response };
  }

  private async _getPdfText(filePath: string, uploadId?: number): Promise<{ text: string; source: string }> {
    let fileId: string | null = null;
    try {
      const fileObj = await this._uploadFile(filePath);
      fileId = fileObj.id || null;
      if (fileId) {
        const text = await this._getFileContent(fileId);
        if (text && text.length > 50) return { text, source: 'kimi_file_extract' };
      }
    } catch (exc: any) {
      log.warn(`File-upload error for upload=${uploadId}: ${exc.message}`);
    } finally {
      if (fileId) await this._deleteFile(fileId, uploadId);
    }

    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = readFileSync(filePath);
      const result = await pdfParse(buffer);
      if (result.text) return { text: result.text, source: 'pdf-parse' };
    } catch (exc: any) {
      log.warn(`pdf-parse error for upload=${uploadId}: ${exc.message}`);
    }

    return { text: '', source: 'none' };
  }

  async classifyDocument(pdfText: string, uploadId?: number): Promise<KimiResult> {
    const result = await this._callChatCompletion(this._buildPayload(CLASSIFICATION_PROMPT, pdfText), uploadId);
    if (!result.success) return result;
    const data = result.data || {};
    const validTypes = ['brokerage', 'bank', 'credit_card', 'unknown'];
    return {
      success: true,
      data: {
        doc_type: validTypes.includes(data.doc_type) ? data.doc_type : 'unknown',
        institution: data.institution || 'Unknown',
        statement_date: data.statement_date,
        account_holder: data.account_holder,
        account_number: data.account_number,
        confidence: data.confidence || 0.5,
      },
    };
  }

  async extractStructuredData(pdfText: string, docType: string, uploadId?: number): Promise<KimiResult> {
    const prompt = docType === 'brokerage' ? BROKERAGE_EXTRACTION_PROMPT : docType === 'credit_card' ? CREDIT_CARD_EXTRACTION_PROMPT : BANK_EXTRACTION_PROMPT;
    return this._callChatCompletion(this._buildPayload(prompt, pdfText), uploadId);
  }

  async repairJson(rawText: string, uploadId?: number): Promise<KimiResult> {
    const prompt = JSON_REPAIR_PROMPT + rawText.slice(0, 15000);
    return this._callChatCompletion({
      model: this.model,
      messages: [
        { role: 'system', content: 'You are a JSON repair assistant.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 4000,
    }, uploadId);
  }

  private _buildPayload(systemPrompt: string, pdfText: string) {
    const maxChars = 30000;
    const truncated = pdfText.length > maxChars ? pdfText.slice(0, maxChars) + '\n...[truncated]' : pdfText;
    return {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Below is the extracted text from a financial statement PDF.\n\n--- PDF TEXT START ---\n${truncated}\n--- PDF TEXT END ---` },
      ],
      max_tokens: 4000,
    };
  }

  private async _uploadFile(filePath: string): Promise<{ id: string }> {
    const filename = basename(filePath);
    const buffer = readFileSync(filePath);
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
    formData.append('purpose', 'file-extract');
    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
    return response.json();
  }

  private async _getFileContent(fileId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}/content`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw new Error(`Get content failed: ${response.status}`);
    return response.text();
  }

  private async _deleteFile(fileId: string, uploadId?: number): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
    } catch (exc: any) {
      log.warn(`Failed to delete file for upload=${uploadId}: ${exc.message}`);
    }
  }

  private async _callChatCompletion(payload: any, uploadId?: number): Promise<KimiResult> {
    try {
      const bodySize = JSON.stringify(payload).length;
      log.info(`_callChatCompletion for upload=${uploadId}, bodySize=${bodySize} chars, model=${payload.model}`);

      const response = await fetchWithRetry(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }, uploadId);
      if (!response.ok) {
        // This path is unlikely now since fetchWithRetry throws on non-ok after retries,
        // but keep it as a safety net.
        const errText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errText.slice(0, 500)}` };
      }
      log.info(`Parsing JSON response for upload=${uploadId}`);
      const result = await response.json();
      log.info(`Response parsed for upload=${uploadId}, model=${result.model}, usage=${JSON.stringify(result.usage)}`);

      let content: string = result.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: 'Unexpected response structure' };

      log.info(`Extracting JSON from markdown for upload=${uploadId}, contentLength=${content.length}`);

      try {
        if (content.includes('```json')) content = content.split('```json')[1].split('```')[0];
        else if (content.includes('```')) content = content.split('```')[1].split('```')[0];
        let stripped = content.trim();
        if (!stripped) return { success: false, error: 'Empty response content', raw_response: content };

        // Try sanitized version first (fixes trailing commas, etc.)
        const sanitized = sanitizeJson(stripped);
        try {
          const extractedData = JSON.parse(sanitized);
          log.info(`JSON parsed successfully for upload=${uploadId} (with sanitization)`);
          return { success: true, data: extractedData, raw_response: content, confidence: extractedData.extraction_confidence || 0.5, model: result.model || 'unknown', usage: result.usage || {} };
        } catch {
          // Sanitization didn't help — fall through to normal error handling
        }

        const extractedData = JSON.parse(stripped);
        log.info(`JSON parsed successfully for upload=${uploadId}`);
        return { success: true, data: extractedData, raw_response: content, confidence: extractedData.extraction_confidence || 0.5, model: result.model || 'unknown', usage: result.usage || {} };
      } catch (exc: any) {
        const context = extractErrorContext(content, exc.message);
        log.error(`JSON parse failed for upload=${uploadId}: ${exc.message}\n\nError context:\n${context}`, content);
        return { success: false, error: `Failed to parse JSON: ${exc.message}`, raw_response: content };
      }
    } catch (exc: any) {
      log.error(`_callChatCompletion failed for upload=${uploadId}: ${exc.message}`);
      return { success: false, error: exc.message };
    }
  }
}

let _kimiService: KimiService | null = null;
export function getKimiService(): KimiService {
  if (!_kimiService) _kimiService = new KimiService();
  return _kimiService;
}
