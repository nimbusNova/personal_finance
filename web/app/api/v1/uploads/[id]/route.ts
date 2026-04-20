export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { existsSync, unlinkSync } from 'fs';
import { jsonResponse, notFoundResponse } from '@/lib/api-utils';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const pdfId = parseInt(params.id);
  const pdf = db.select().from(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).get();
  if (!pdf) return notFoundResponse('PDF not found');
  return jsonResponse({ id: pdf.id, account_id: pdf.accountId, original_filename: pdf.originalFilename, file_path: pdf.filePath, file_size: pdf.fileSize, doc_type: pdf.docType, extraction_status: pdf.extractionStatus, extraction_confidence: pdf.extractionConfidence, extracted_data: pdf.extractedData, error_message: pdf.errorMessage, created_at: pdf.createdAt });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const pdfId = parseInt(params.id);
  const body = await request.json();
  const pdf = db.select().from(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).get();
  if (!pdf) return notFoundResponse('PDF not found');
  db.update(schema.pdfs).set({ extractedData: body.extracted_data }).where(eq(schema.pdfs.id, pdfId)).run();
  return jsonResponse({ id: pdfId, extraction_status: pdf.extractionStatus, extracted_data: body.extracted_data, message: 'Extracted data updated' });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const pdfId = parseInt(params.id);
  const pdf = db.select().from(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).get();
  if (!pdf) return notFoundResponse('PDF not found');
  const snapshots = db.select().from(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.pdfId, pdfId)).all();
  for (const snap of snapshots) db.delete(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.id, snap.id)).run();
  db.delete(schema.transactions).where(eq(schema.transactions.pdfId, pdfId)).run();
  db.delete(schema.accountBalances).where(eq(schema.accountBalances.pdfId, pdfId)).run();
  db.delete(schema.extractionJobs).where(eq(schema.extractionJobs.pdfId, pdfId)).run();
  db.delete(schema.manualCorrections).where(eq(schema.manualCorrections.pdfId, pdfId)).run();
  if (pdf.filePath && existsSync(pdf.filePath)) try { unlinkSync(pdf.filePath); } catch { /* ignore */ }
  db.delete(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).run();
  return jsonResponse({ message: 'Upload deleted', pdf_id: pdfId });
}
