export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { processPdfExtraction } from '@/lib/services/extraction';
import { jsonResponse, notFoundResponse, badRequestResponse } from '@/lib/api-utils';
import { existsSync } from 'fs';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const pdfId = parseInt(params.id);
  const pdf = db.select().from(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).get();
  if (!pdf) return notFoundResponse('PDF not found');
  if (!pdf.filePath || !existsSync(pdf.filePath)) return badRequestResponse('PDF file no longer exists on disk');
  db.update(schema.pdfs).set({ extractionStatus: 'pending', processingStep: 'Pending extraction', errorMessage: null, extractedData: null, extractionConfidence: null }).where(eq(schema.pdfs.id, pdfId)).run();
  processPdfExtraction(pdfId, pdf.filePath).catch(err => console.error(`[upload][${pdfId}] Background retry error:`, err));
  return jsonResponse({ message: 'Extraction retry queued', pdf_id: pdfId, status: 'pending' });
}
