export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse, notFoundResponse } from '@/lib/api-utils';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const transactionId = parseInt(params.id);
  const body = await request.json();
  const transaction = db.select().from(schema.transactions).where(eq(schema.transactions.id, transactionId)).get();
  if (!transaction) return notFoundResponse('Transaction not found');
  db.update(schema.transactions).set({ category: body.category }).where(eq(schema.transactions.id, transactionId)).run();
  return jsonResponse({ id: transactionId, category: body.category, message: 'Category updated' });
}
