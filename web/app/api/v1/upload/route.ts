export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { generatePdfPath, savePdfFile } from '@/lib/services/pdf-storage';
import { processPdfExtraction } from '@/lib/services/extraction';
import { jsonResponse, badRequestResponse, notFoundResponse } from '@/lib/api-utils';
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accountIdStr = formData.get('account_id') as string;
    const accountId = accountIdStr ? parseInt(accountIdStr) : null;
    if (!file || file.type !== 'application/pdf') return badRequestResponse('Only PDF files allowed');
    if (accountId) {
      const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
      if (!account) return notFoundResponse('Account not found');
    }
    if (accountId && file.name) {
      const existing = db.select().from(schema.pdfs).where(eq(schema.pdfs.accountId, accountId)).all()
        .filter(p => p.originalFilename === file.name && (p.extractionStatus === 'completed' || p.extractionStatus === 'processing')).shift();
      if (existing) return jsonResponse({ message: 'This file has already been uploaded for this account.', pdf_id: existing.id, original_filename: existing.originalFilename, status: 'duplicate', extraction_status: existing.extractionStatus });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSize = buffer.length;
    const { filePath } = generatePdfPath(file.name || 'document.pdf');
    savePdfFile(buffer, filePath);
    const pdf = db.insert(schema.pdfs).values({ accountId, originalFilename: file.name, filePath, fileSize, extractionStatus: 'pending' }).returning().get();
    processPdfExtraction(pdf.id, filePath).catch(err => console.error(`[upload][${pdf.id}] Background extraction error:`, err));
    return jsonResponse({ message: 'Upload successful', upload_id: pdf.id, pdf_id: pdf.id, original_filename: pdf.originalFilename, file_path: filePath, file_size: fileSize, status: 'pending_extraction' });
  } catch (e: any) { return jsonResponse({ error: `Upload failed: ${e.message}` }, 500); }
}
