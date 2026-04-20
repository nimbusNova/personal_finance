export const dynamic = 'force-dynamic';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() {
  const latestRows = db.select({ accountId: schema.portfolioSnapshots.accountId, latestDate: sql<string>`MAX(${schema.portfolioSnapshots.statementDate})`.as('latest_date') }).from(schema.portfolioSnapshots).groupBy(schema.portfolioSnapshots.accountId).all();
  let brokerageTotal = 0, cashBalance = 0, investedValue = 0;
  const snapshotIds: number[] = [];
  for (const row of latestRows) {
    const snapshot = db.select().from(schema.portfolioSnapshots).where(sql`${schema.portfolioSnapshots.accountId} = ${row.accountId} AND ${schema.portfolioSnapshots.statementDate} = ${row.latestDate}`).get();
    if (snapshot) { brokerageTotal += snapshot.totalValue || 0; cashBalance += snapshot.cashBalance || 0; investedValue += snapshot.investedValue || 0; snapshotIds.push(snapshot.id); }
  }
  const allocation: Record<string, number> = {};
  if (snapshotIds.length) {
    const holdings = db.select().from(schema.holdings).where(sql`${schema.holdings.snapshotId} IN (${sql.join(snapshotIds)})`).all();
    for (const h of holdings) { const ac = h.assetClass || 'unknown'; allocation[ac] = (allocation[ac] || 0) + (h.marketValue || 0); }
  }
  if (cashBalance > 0) allocation.cash = cashBalance;
  const allocationPct: Record<string, number> = {};
  if (brokerageTotal > 0) for (const [k, v] of Object.entries(allocation)) allocationPct[k] = Math.round((v / brokerageTotal) * 10000) / 100;

  const accountRows = db.select().from(schema.accounts).innerJoin(schema.institutions, eq(schema.accounts.institutionId, schema.institutions.id)).all();
  let bankTotal = 0, ccDebt = 0;
  const accountSummaries: any[] = [];
  const latestDates: Date[] = [];
  for (const row of accountRows) {
    const account = row.accounts, institution = row.institutions;
    const latestBalance = db.select().from(schema.accountBalances).where(eq(schema.accountBalances.accountId, account.id)).orderBy(desc(schema.accountBalances.statementDate)).get();
    const bal = latestBalance?.balance ?? null;
    if (bal !== null) { if (account.accountType === 'bank') bankTotal += bal; else if (account.accountType === 'credit_card') ccDebt += bal; }
    accountSummaries.push({ id: account.id, name: account.name, type: account.accountType, institution: institution.name, balance: bal, statement_date: latestBalance?.statementDate?.toISOString() ?? null });
    if (latestBalance?.statementDate) latestDates.push(latestBalance.statementDate);
  }
  for (const sid of snapshotIds) { const snap = db.select().from(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.id, sid)).get(); if (snap?.statementDate) latestDates.push(snap.statementDate); }

  let maxDate: Date | null = null;
  for (const d of latestDates) if (!maxDate || d > maxDate) maxDate = d;
  return jsonResponse({ total_value: brokerageTotal + bankTotal - ccDebt, cash_balance: cashBalance + bankTotal, invested_value: investedValue, credit_card_debt: ccDebt, brokerage_total: brokerageTotal, bank_total: bankTotal, account_count: accountRows.length, allocation: allocationPct, latest_date: maxDate?.toISOString() ?? null, accounts: accountSummaries });
}
