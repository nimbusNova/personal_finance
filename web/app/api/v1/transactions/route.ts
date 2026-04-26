export const dynamic = 'force-dynamic';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse, notFoundResponse } from '@/lib/api-utils';

function parseDateStr(dateStr: string | null): Date | null {
  if (!dateStr) return null;
  try { if (dateStr.includes('T')) return new Date(dateStr); const d = new Date(dateStr); return isNaN(d.getTime()) ? null : d; } catch { return null; }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('account_id');
  const startDate = parseDateStr(searchParams.get('start_date'));
  const endDate = parseDateStr(searchParams.get('end_date'));
  const category = searchParams.get('category');
  const minAmount = searchParams.get('min_amount');
  let txs = db.select().from(schema.transactions).orderBy(desc(schema.transactions.date)).all();
  if (accountId) txs = txs.filter(t => t.accountId === parseInt(accountId));
  if (startDate) txs = txs.filter(t => t.date && t.date >= startDate);
  if (endDate) txs = txs.filter(t => t.date && t.date <= endDate);
  if (category) txs = txs.filter(t => t.category === category);
  if (minAmount) txs = txs.filter(t => t.amount >= parseFloat(minAmount));
  return jsonResponse({ transactions: txs.map(t => ({ id: t.id, account_id: t.accountId, date: t.date, merchant: t.merchant, category: t.category, amount: t.amount, is_recurring: t.isRecurring, recurring_frequency: t.recurringFrequency })) });
}


