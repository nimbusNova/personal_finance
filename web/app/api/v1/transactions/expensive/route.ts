export const dynamic = 'force-dynamic';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const threshold = parseFloat(searchParams.get('threshold') || '200');
  const days = parseInt(searchParams.get('days') || '30');
  const year = searchParams.get('year');
  const month = searchParams.get('month');
  let txs = db.select().from(schema.transactions).all();
  if (year && month) {
    const y = parseInt(year), m = parseInt(month);
    const startDate = new Date(y, m - 1, 1), endDate = new Date(y, m, 0, 23, 59, 59);
    txs = txs.filter(t => t.date && t.date >= startDate && t.date <= endDate);
  } else {
    const startDate = new Date(); startDate.setDate(startDate.getDate() - days);
    txs = txs.filter(t => t.date && t.date >= startDate && t.amount >= threshold);
  }
  txs.sort((a, b) => (b.amount || 0) - (a.amount || 0));
  return jsonResponse({ transactions: txs.map(t => ({ id: t.id, date: t.date, merchant: t.merchant, category: t.category, amount: t.amount })), threshold, count: txs.length });
}
