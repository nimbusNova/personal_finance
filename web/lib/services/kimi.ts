import { readFileSync } from 'fs';
import { basename } from 'path';
import { getKimiApiKey, getKimiBaseUrl } from './settings';

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
Do not add explanations, markdown, or commentary.

Broken JSON:
`;

export interface KimiResult {
  success: boolean;
  data?: any;
  error?: string;
  raw_response?: string;
  confidence?: number;
  model?: string;
  usage?: any;
}

class KimiService {
  apiKey: string;
  baseUrl: string;
  model: string;

  constructor() {
    this.apiKey = getKimiApiKey();
    this.baseUrl = getKimiBaseUrl();
    this.model = KIMI_MODEL;
    console.log(`[kimi] Initialized: base_url=${this.baseUrl}, model=${this.model}, key_set=${this.apiKey ? 'yes' : 'no'}`);
  }

  async extractFromPdf(filePath: string, uploadId?: number): Promise<KimiResult> {
    const { text: pdfText, source: textSource } = await this._getPdfText(filePath, uploadId);
    if (!pdfText) return { success: false, error: 'Could not extract text from PDF' };

    const classification = await this.classifyDocument(pdfText, uploadId);
    if (!classification.success) return { success: false, error: `Classification failed: ${classification.error}` };

    const docType = classification.data?.doc_type || 'unknown';
    const institution = classification.data?.institution || 'Unknown';
    const statementDate = classification.data?.statement_date;

    const extraction = await this.extractStructuredData(pdfText, docType, uploadId);
    if (extraction.success) {
      const data = extraction.data || {};
      data.doc_type = data.doc_type || docType;
      data.institution = data.institution || institution;
      data.statement_date = data.statement_date || statementDate;
      data.classification = classification.data;
      return { success: true, data };
    }

    const raw = extraction.raw_response;
    if (raw) {
      const repair = await this.repairJson(raw, uploadId);
      if (repair.success) {
        const data = repair.data || {};
        data.doc_type = data.doc_type || docType;
        data.institution = data.institution || institution;
        data.statement_date = data.statement_date || statementDate;
        data.classification = classification.data;
        return { success: true, data };
      }
    }

    return { success: false, error: `All extraction stages failed. Last error: ${extraction.error}` };
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
      console.log(`[kimi][upload=${uploadId}] File-upload error: ${exc.message}`);
    } finally {
      if (fileId) await this._deleteFile(fileId, uploadId);
    }

    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = readFileSync(filePath);
      const result = await pdfParse(buffer);
      if (result.text) return { text: result.text, source: 'pdf-parse' };
    } catch (exc: any) {
      console.log(`[kimi][upload=${uploadId}] pdf-parse error: ${exc.message}`);
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
      console.log(`[kimi][upload=${uploadId}] Failed to delete file: ${exc.message}`);
    }
  }

  private async _callChatCompletion(payload: any, uploadId?: number): Promise<KimiResult> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errText = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${errText.slice(0, 500)}` };
      }
      const result = await response.json();
      let content: string = result.choices?.[0]?.message?.content;
      if (!content) return { success: false, error: 'Unexpected response structure' };

      try {
        if (content.includes('```json')) content = content.split('```json')[1].split('```')[0];
        else if (content.includes('```')) content = content.split('```')[1].split('```')[0];
        const stripped = content.trim();
        if (!stripped) return { success: false, error: 'Empty response content', raw_response: content };
        const extractedData = JSON.parse(stripped);
        return { success: true, data: extractedData, raw_response: content, confidence: extractedData.extraction_confidence || 0.5, model: result.model || 'unknown', usage: result.usage || {} };
      } catch (exc: any) {
        return { success: false, error: `Failed to parse JSON: ${exc.message}`, raw_response: content };
      }
    } catch (exc: any) {
      return { success: false, error: exc.message };
    }
  }
}

let _kimiService: KimiService | null = null;
export function getKimiService(): KimiService {
  if (!_kimiService) _kimiService = new KimiService();
  return _kimiService;
}
