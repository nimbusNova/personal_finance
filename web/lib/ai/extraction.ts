import { z } from 'zod';
import { readFileSync } from 'fs';
import { createServerLogger } from '../server-logger';
import { createLLMService, type LLMService } from './service';
import {
  CLASSIFICATION_SYSTEM_PROMPT,
  BROKERAGE_EXTRACTION_PROMPT,
  HOLDINGS_LIST_PROMPT,
  ACCOUNT_METADATA_PROMPT,
  BANK_EXTRACTION_PROMPT,
  CREDIT_CARD_EXTRACTION_PROMPT,
  buildExtractionPrompt,
} from './prompts';

const log = createServerLogger('ai-extract');

// ── Zod Schemas ──

export const ClassificationSchema = z.object({
  doc_type: z.enum(['brokerage', 'bank', 'credit_card', 'unknown']),
  institution: z.string(),
  statement_date: z.string().optional(),
  account_holder: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1),
});

const HoldingSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  asset_class: z.string().optional(),
  sector: z.string().optional(),
  geography: z.string().optional(),
  quantity: z.number().optional(),
  price: z.number().optional(),
  market_value: z.number().optional(),
  cost_basis: z.number().optional(),
});

const BrokerageSchema = z.object({
  doc_type: z.literal('brokerage'),
  institution: z.string().optional(),
  account_type: z.string().optional(),
  statement_date: z.string().optional(),
  holdings: z.array(HoldingSchema),
  cash: z.object({
    settled_cash: z.number().optional(),
    unsettled_cash: z.number().optional(),
  }).optional(),
  total_value: z.number().optional(),
  other_assets: z.number().optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
});

const HoldingsListSchema = z.object({
  holdings: z.array(HoldingSchema),
  extraction_confidence: z.number().min(0).max(1).optional(),
});

const AccountMetadataSchema = z.object({
  account_type: z.string().optional(),
  statement_date: z.string().optional(),
  cash: z.object({
    settled_cash: z.number().optional(),
    unsettled_cash: z.number().optional(),
  }).optional(),
  total_value: z.number().optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
});

const TransactionSchema = z.object({
  date: z.string().optional(),
  description: z.string().optional(),
  merchant: z.string().optional(),
  category: z.string().optional(),
  amount: z.number().optional(),
  is_recurring: z.boolean().optional(),
  recurring_frequency: z.string().optional(),
});

const BankSchema = z.object({
  doc_type: z.literal('bank'),
  institution: z.string().optional(),
  account_name: z.string().optional(),
  account_type: z.string().optional(),
  statement_date: z.string().optional(),
  statement_period: z.object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  }).optional(),
  beginning_balance: z.number().optional(),
  ending_balance: z.number().optional(),
  transactions: z.array(TransactionSchema).optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
});

const CreditCardSchema = z.object({
  doc_type: z.literal('credit_card'),
  institution: z.string().optional(),
  account_name: z.string().optional(),
  statement_date: z.string().optional(),
  statement_balance: z.number().optional(),
  transactions: z.array(TransactionSchema).optional(),
  extraction_confidence: z.number().min(0).max(1).optional(),
});

// ── Result Types ──

export interface ExtractionResult {
  success: boolean;
  data?: any;
  error?: string;
  raw_response?: string;
  confidence?: number;
  provider?: string;
  model?: string;
}

// ── PDF Text Extraction ──

export async function extractPdfText(filePath: string): Promise<string> {
  try {
    const pdfParseMod = await import('pdf-parse');
    const pdfParse = (pdfParseMod as any).default || pdfParseMod;
    const buffer = readFileSync(filePath);
    const result = await pdfParse(buffer);
    if (result.text) return result.text;
  } catch (exc: any) {
    log.warn(`pdf-parse error: ${exc.message}`);
  }
  return '';
}

// ── Main Pipeline ──

export async function extractFromPDF(
  filePath: string,
  pdfId?: number,
  onProgress?: (step: string) => void
): Promise<ExtractionResult> {
  onProgress?.('reading_pdf');
  const pdfText = await extractPdfText(filePath);
  if (!pdfText) {
    return { success: false, error: 'Could not extract text from PDF' };
  }

  const llm = await createLLMService();

  // ── Stage 1: Classification ──
  onProgress?.('classifying');
  const classification = await classifyDocument(llm, pdfText, pdfId);
  if (!classification.success) {
    return { success: false, error: `Classification failed: ${classification.error}` };
  }

  const docType = classification.data?.doc_type || 'unknown';
  const institution = classification.data?.institution || 'Unknown';
  const statementDate = classification.data?.statement_date;
  const classificationConfidence = classification.data?.confidence || 0.5;

  if (docType === 'unknown') {
    return { success: false, error: 'Could not classify document', confidence: classificationConfidence };
  }

  // ── Stage 2: Structured Extraction ──
  let extraction: ExtractionResult;

  if (docType === 'brokerage') {
    extraction = await extractBrokerage(llm, pdfText, pdfId, statementDate, institution);
  } else if (docType === 'bank') {
    extraction = await extractBank(llm, pdfText, pdfId, statementDate, institution);
  } else if (docType === 'credit_card') {
    extraction = await extractCreditCard(llm, pdfText, pdfId, statementDate, institution);
  } else {
    return { success: false, error: `Unsupported doc type: ${docType}` };
  }

  if (extraction.success) {
    const data = extraction.data || {};
    data.doc_type = docType;
    data.institution = institution;
    data.statement_date = data.statement_date || statementDate;
    data.classification = classification.data;
    return {
      success: true,
      data,
      raw_response: extraction.raw_response,
      confidence: extraction.confidence,
    };
  }

  return { success: false, error: extraction.error };
}

// ── Stage Implementations ──

async function classifyDocument(
  llm: LLMService,
  pdfText: string,
  pdfId?: number
): Promise<ExtractionResult> {
  try {
    const { system, prompt } = buildExtractionPrompt(CLASSIFICATION_SYSTEM_PROMPT, pdfText);
    const result = await llm.generateObject(
      { system, prompt, schema: ClassificationSchema, temperature: 0 },
      { taskType: 'classification', pdfId }
    );
    return { success: true, data: result.content, confidence: result.content.confidence };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function extractBrokerage(
  llm: LLMService,
  pdfText: string,
  pdfId?: number,
  statementDate?: string,
  institution?: string
): Promise<ExtractionResult> {
  // Two-pass: holdings list + account metadata
  const { system: hSystem, prompt: hPrompt } = buildExtractionPrompt(
    HOLDINGS_LIST_PROMPT, pdfText, statementDate
  );

  const holdingsResult = await llm.generateObject(
    { system: hSystem, prompt: hPrompt, schema: HoldingsListSchema, temperature: 0.1, maxTokens: 8000 },
    { taskType: 'extraction', pdfId }
  );

  const { system: mSystem, prompt: mPrompt } = buildExtractionPrompt(
    ACCOUNT_METADATA_PROMPT, pdfText, statementDate
  );

  const metaResult = await llm.generateObject(
    { system: mSystem, prompt: mPrompt, schema: AccountMetadataSchema, temperature: 0.1, maxTokens: 4000 },
    { taskType: 'extraction', pdfId }
  );

  const data = {
    doc_type: 'brokerage',
    institution,
    statement_date: statementDate,
    account_type: metaResult.content.account_type || '',
    holdings: holdingsResult.content.holdings || [],
    cash: metaResult.content.cash || { settled_cash: 0, unsettled_cash: 0 },
    total_value: metaResult.content.total_value || 0,
    extraction_confidence: Math.min(
      (holdingsResult.content as any).extraction_confidence || 0.5,
      (metaResult.content as any).extraction_confidence || 0.5
    ),
  };

  return {
    success: true,
    data,
    confidence: data.extraction_confidence,
    raw_response: JSON.stringify(data),
  };
}

async function extractBank(
  llm: LLMService,
  pdfText: string,
  pdfId?: number,
  statementDate?: string,
  institution?: string
): Promise<ExtractionResult> {
  const { system, prompt } = buildExtractionPrompt(BANK_EXTRACTION_PROMPT, pdfText, statementDate);

  const result = await llm.generateObject(
    { system, prompt, schema: BankSchema, temperature: 0.1, maxTokens: 16000 },
    { taskType: 'extraction', pdfId }
  );

  const data = {
    ...result.content,
    institution: result.content.institution || institution,
    statement_date: result.content.statement_date || statementDate,
  };

  return {
    success: true,
    data,
    confidence: (result.content as any).extraction_confidence || 0.5,
    raw_response: JSON.stringify(data),
  };
}

async function extractCreditCard(
  llm: LLMService,
  pdfText: string,
  pdfId?: number,
  statementDate?: string,
  institution?: string
): Promise<ExtractionResult> {
  const { system, prompt } = buildExtractionPrompt(CREDIT_CARD_EXTRACTION_PROMPT, pdfText, statementDate);

  const result = await llm.generateObject(
    { system, prompt, schema: CreditCardSchema, temperature: 0.1, maxTokens: 16000 },
    { taskType: 'extraction', pdfId }
  );

  const data = {
    ...result.content,
    institution: result.content.institution || institution,
    statement_date: result.content.statement_date || statementDate,
  };

  return {
    success: true,
    data,
    confidence: (result.content as any).extraction_confidence || 0.5,
    raw_response: JSON.stringify(data),
  };
}
