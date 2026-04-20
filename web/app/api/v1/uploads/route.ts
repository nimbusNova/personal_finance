export const dynamic = 'force-dynamic';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('account_id');
  const status = searchParams.get('status');
  let uploads = db.select().from(schema.pdfs).orderBy(desc(schema.pdfs.createdAt)).all();
  if (accountId) uploads = uploads.filter(u => u.accountId === parseInt(accountId));
  if (status) uploads = uploads.filter(u => u.extractionStatus === status);
  return jsonResponse({ uploads: uploads.map(u => ({ id: u.id, account_id: u.accountId, original_filename: u.originalFilename, file_path: u.filePath, file_size: u.fileSize, doc_type: u.docType, extraction_status: u.extractionStatus, processing_step: u.processingStep, extraction_confidence: u.extractionConfidence, created_at: u.createdAt })) });
}
