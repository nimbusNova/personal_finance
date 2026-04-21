export const dynamic = 'force-dynamic';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() {
  const rows = db.select().from(schema.accounts).innerJoin(schema.institutions, eq(schema.accounts.institutionId, schema.institutions.id)).orderBy(desc(schema.accounts.createdAt)).all();
  const seen = new Map<string, any>();
  for (const row of rows) {
    const account = row.accounts, institution = row.institutions;
    const key = `${account.institutionId}-${account.name}`;
    if (seen.has(key)) continue;
    const latestBalance = db.select().from(schema.accountBalances).where(eq(schema.accountBalances.accountId, account.id)).orderBy(desc(schema.accountBalances.statementDate)).get();
    const pdfCount = db.select({ count: sql<number>`count(*)` }).from(schema.pdfs).where(eq(schema.pdfs.accountId, account.id)).get();
    seen.set(key, { id: account.id, name: account.name, type: account.accountType, account_number_masked: account.accountNumberMasked, is_active: account.isActive, institution: { id: institution.id, name: institution.name, type: institution.type }, balance: latestBalance?.balance ?? null, statement_date: latestBalance?.statementDate?.toISOString() ?? null, pdf_count: pdfCount?.count ?? 0, created_at: account.createdAt?.toISOString() ?? null });
  }
  return jsonResponse({ accounts: Array.from(seen.values()) });
}
