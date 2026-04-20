import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { getKimiService } from './kimi';
import type { KimiResult } from './kimi';

const HOLDINGS_VALUE_TOLERANCE = 0.01;

export async function processPdfExtraction(pdfId: number, filePath: string): Promise<void> {
  console.log(`[extract][${pdfId}] Starting extraction: ${filePath}`);

  db.update(schema.pdfs)
    .set({ extractionStatus: 'processing', processedAt: new Date() })
    .where(eq(schema.pdfs.id, pdfId))
    .run();

  const jobResult = db.insert(schema.extractionJobs)
    .values({ pdfId, jobType: 'extraction', status: 'running', startedAt: new Date() })
    .returning().get();
  const jobId = jobResult.id;

  try {
    const service = getKimiService();
    const result: KimiResult = await service.extractFromPdf(filePath, pdfId);

    if (!result.success) {
      markFailed(pdfId, jobId, result.error || 'Unknown extraction error');
      return;
    }

    const extracted = result.data || {};
    const confidence = result.confidence || extracted.extraction_confidence || 0.5;
    const docType = extracted.doc_type || 'unknown';

    db.update(schema.pdfs)
      .set({ extractedData: extracted, extractionConfidence: confidence, docType })
      .where(eq(schema.pdfs.id, pdfId))
      .run();

    const validationErrors = validateExtraction(extracted, docType);
    if (validationErrors.length > 0) {
      markFailed(pdfId, jobId, `Validation failed: ${validationErrors.join('; ')}`);
      return;
    }

    persistExtraction(pdfId, extracted);

    db.update(schema.pdfs)
      .set({ extractionStatus: 'completed', processingStep: 'Completed', errorMessage: null })
      .where(eq(schema.pdfs.id, pdfId))
      .run();

    db.update(schema.extractionJobs)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(schema.extractionJobs.id, jobId))
      .run();

    console.log(`[extract][${pdfId}] Completed successfully`);
  } catch (exc: any) {
    console.log(`[extract][${pdfId}] Unexpected error: ${exc.message}`);
    markFailed(pdfId, jobId, exc.message);
  }
}

function markFailed(pdfId: number, jobId: number, message: string) {
  db.update(schema.pdfs)
    .set({ extractionStatus: 'failed', processingStep: `Failed: ${message.slice(0, 200)}`, errorMessage: message.slice(0, 500) })
    .where(eq(schema.pdfs.id, pdfId))
    .run();
  db.update(schema.extractionJobs)
    .set({ status: 'failed', errorDetails: { error: message }, completedAt: new Date() })
    .where(eq(schema.extractionJobs.id, jobId))
    .run();
}

function validateExtraction(data: any, docType: string): string[] {
  const errors: string[] = [];
  if (!data) { errors.push('No data extracted'); return errors; }

  if (docType === 'brokerage') {
    const holdings = data.holdings || [];
    const totalValue = data.total_value;
    const cash = data.cash || {};
    const settledCash = cash.settled_cash || 0;
    if (!holdings.length) errors.push('No holdings found');
    if (totalValue == null) errors.push('Missing total_value');
    if (holdings.length && totalValue != null && totalValue > 0) {
      const holdingsSum = holdings.reduce((sum: number, h: any) => sum + (h.market_value || 0), 0);
      const expectedTotal = holdingsSum + settledCash;
      if (Math.abs(expectedTotal - totalValue) / totalValue > HOLDINGS_VALUE_TOLERANCE) {
        errors.push(`Holdings sum (${expectedTotal}) != total_value (${totalValue})`);
      }
    }
    for (const h of holdings) {
      if (h.quantity != null && h.quantity < 0) errors.push(`Negative quantity for ${h.symbol || '?'}`);
    }
  } else if (docType === 'credit_card' || docType === 'bank') {
    const transactions = data.transactions || [];
    if (docType === 'credit_card' && !transactions.length) errors.push('No transactions found');
    else if (docType === 'bank') {
      const hasBalance = data.beginning_balance != null || data.ending_balance != null || data.balances?.beginning_balance != null || data.balances?.ending_balance != null;
      if (!transactions.length && !hasBalance) errors.push('No transactions or balances found');
    }
  }
  return errors;
}

function persistExtraction(pdfId: number, data: any) {
  const docType = data.doc_type;
  const institutionName = data.institution || 'Unknown';
  const accountType = data.account_type || data.account_name || (data.account_number ? data.account_number.slice(-4) : null) || (docType ? docType.charAt(0).toUpperCase() + docType.slice(1) + ' Account' : 'Unknown Account');

  let institution = db.select().from(schema.institutions).where(eq(schema.institutions.name, institutionName)).get();
  if (!institution) {
    institution = db.insert(schema.institutions).values({ name: institutionName, type: docType || 'unknown' }).returning().get();
    console.log(`[extract] Created institution: ${institutionName} (id=${institution.id})`);
  }

  let account = db.select().from(schema.accounts)
    .where(and(eq(schema.accounts.institutionId, institution.id), eq(schema.accounts.name, accountType)))
    .get();

  if (!account && data.account_number) {
    const masked = data.account_number.slice(-4);
    account = db.select().from(schema.accounts)
      .where(and(eq(schema.accounts.institutionId, institution.id), eq(schema.accounts.accountNumberMasked, masked)))
      .get();
  }

  if (!account) {
    account = db.insert(schema.accounts).values({
      institutionId: institution.id,
      name: accountType,
      accountType: docType || 'unknown',
      accountNumberMasked: data.account_number ? data.account_number.slice(-4) : null,
      isActive: true,
    }).returning().get();
    console.log(`[extract] Created account: ${accountType} (id=${account.id})`);
  }

  const pdf = db.select().from(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).get();
  if (pdf && !pdf.accountId) {
    db.update(schema.pdfs).set({ accountId: account.id }).where(eq(schema.pdfs.id, pdfId)).run();
  }

  const statementDate = parseDate(data.statement_date);
  if (statementDate) clearExistingData(account.id, docType, statementDate);

  if (docType === 'brokerage') persistBrokerage(pdfId, account.id, data);
  else if (docType === 'credit_card') persistCreditCard(pdfId, account.id, data);
  else if (docType === 'bank') persistBank(pdfId, account.id, data);
}

function clearExistingData(accountId: number, docType: string, statementDate: Date) {
  if (docType === 'brokerage') {
    const oldSnapshots = db.select().from(schema.portfolioSnapshots)
      .where(and(eq(schema.portfolioSnapshots.accountId, accountId), eq(schema.portfolioSnapshots.statementDate, statementDate)))
      .all();
    for (const old of oldSnapshots) {
      db.delete(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.id, old.id)).run();
    }
  } else if (docType === 'credit_card' || docType === 'bank') {
    db.delete(schema.transactions)
      .where(and(eq(schema.transactions.accountId, accountId), eq(schema.transactions.statementDate, statementDate), isNotNull(schema.transactions.pdfId)))
      .run();
  }
  db.delete(schema.accountBalances)
    .where(and(eq(schema.accountBalances.accountId, accountId), eq(schema.accountBalances.statementDate, statementDate)))
    .run();
}

function persistBrokerage(pdfId: number, accountId: number, data: any) {
  const statementDate = parseDate(data.statement_date) || new Date();
  const cashData = data.cash || {};
  const cashBalance = cashData.settled_cash || 0;
  const totalValue = data.total_value || 0;
  const holdingsList = data.holdings || [];
  const investedValue = holdingsList.reduce((sum: number, h: any) => sum + (h.market_value || 0), 0);

  const snapshot = db.insert(schema.portfolioSnapshots).values({
    accountId, pdfId, statementDate, totalValue, cashBalance, investedValue, diversityScore: null,
  }).returning().get();

  const totalMv = investedValue || 1;
  for (const h of holdingsList) {
    const mv = h.market_value || 0;
    db.insert(schema.holdings).values({
      snapshotId: snapshot.id,
      symbol: h.symbol || 'UNKNOWN',
      name: h.name || '',
      assetClass: h.asset_class || 'unknown',
      sector: h.sector || null,
      geography: h.geography || null,
      quantity: h.quantity || 0,
      price: h.price || 0,
      marketValue: mv,
      costBasis: h.cost_basis || null,
      unrealizedPnl: null,
      weightPct: totalMv > 0 ? (mv / totalMv) * 100 : 0,
      isManualCorrection: false,
    }).run();
  }

  db.insert(schema.accountBalances).values({ accountId, pdfId, statementDate, balance: totalValue }).run();
}

function persistCreditCard(pdfId: number, accountId: number, data: any) {
  const statementDate = parseDate(data.statement_date);
  const transactions = data.transactions || [];
  for (const t of transactions) {
    db.insert(schema.transactions).values({
      accountId, pdfId,
      date: parseDate(t.date) || statementDate || new Date(),
      merchant: t.merchant || t.description || 'Unknown',
      category: t.category || 'Other',
      amount: t.amount || 0,
      isRecurring: !!t.is_recurring,
      recurringFrequency: t.recurring_frequency || null,
      statementDate,
      isManualCorrection: false,
    }).run();
  }
  const statementBalance = data.statement_balance || 0;
  if (statementBalance > 0) {
    db.insert(schema.accountBalances).values({ accountId, pdfId, statementDate, balance: statementBalance }).run();
  }
}

function persistBank(pdfId: number, accountId: number, data: any) {
  const statementDate = parseDate(data.statement_date);
  const transactions = data.transactions || [];
  for (const t of transactions) {
    db.insert(schema.transactions).values({
      accountId, pdfId,
      date: parseDate(t.date) || statementDate || new Date(),
      merchant: t.description || t.merchant || 'Unknown',
      category: t.category || 'Other',
      amount: t.amount || 0,
      isRecurring: !!t.is_recurring,
      recurringFrequency: t.recurring_frequency || null,
      statementDate,
      isManualCorrection: false,
    }).run();
  }
  const endingBalance = data.ending_balance || data.balances?.ending_balance || 0;
  if (endingBalance > 0 || data.ending_balance != null) {
    db.insert(schema.accountBalances).values({ accountId, pdfId, statementDate, balance: endingBalance }).run();
  }
}

function parseDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  try {
    const d = new Date(String(dateStr).slice(0, 10));
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
}
