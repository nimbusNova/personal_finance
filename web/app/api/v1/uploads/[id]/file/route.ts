export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { readFileSync, existsSync } from 'fs';
import { notFoundResponse } from '@/lib/api-utils';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const pdfId = parseInt(params.id);
  const pdf = db.select().from(schema.pdfs).where(eq(schema.pdfs.id, pdfId)).get();
  if (!pdf) return notFoundResponse('PDF not found');
  if (!pdf.filePath || !existsSync(pdf.filePath)) return notFoundResponse('PDF file no longer exists on disk');
  const buffer = readFileSync(pdf.filePath);
  const filename = pdf.originalFilename || pdf.filePath.split('/').pop() || 'document.pdf';
  return new Response(buffer, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${filename}"` } });
}
