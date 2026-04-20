export const dynamic = 'force-dynamic';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() {
  const latestSnapshots = db.select({ accountId: schema.portfolioSnapshots.accountId, latestDate: sql<string>`MAX(${schema.portfolioSnapshots.statementDate})`.as('latest_date') }).from(schema.portfolioSnapshots).groupBy(schema.portfolioSnapshots.accountId).all();
  const result: any[] = [];
  for (const ls of latestSnapshots) {
    const snapshot = db.select().from(schema.portfolioSnapshots).where(and(eq(schema.portfolioSnapshots.accountId, ls.accountId), sql`${schema.portfolioSnapshots.statementDate} = ${ls.latestDate}`)).get();
    if (!snapshot) continue;
    const holdings = db.select().from(schema.holdings).where(eq(schema.holdings.snapshotId, snapshot.id)).all();
    for (const h of holdings) result.push({ id: h.id, account_id: snapshot.accountId, statement_date: snapshot.statementDate, symbol: h.symbol, name: h.name, quantity: h.quantity, market_value: h.marketValue });
  }
  return jsonResponse({ holdings: result });
}
