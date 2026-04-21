export const dynamic = 'force-dynamic';
import { and, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse, badRequestResponse } from '@/lib/api-utils';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || '');
  const month = parseInt(searchParams.get('month') || '');
  if (isNaN(year) || isNaN(month)) return badRequestResponse('year and month are required');
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const txs = db.select().from(schema.transactions).where(and(gte(schema.transactions.date, startDate), lte(schema.transactions.date, endDate))).all();
  const groups: Record<string, { total: number; count: number }> = {};
  for (const t of txs) { const cat = t.category || 'Other'; if (!groups[cat]) groups[cat] = { total: 0, count: 0 }; groups[cat].total += t.amount || 0; groups[cat].count++; }
  return jsonResponse({ summary: Object.entries(groups).map(([category, data]) => ({ category, total: Math.round(data.total * 100) / 100, count: data.count })), year, month });
}
