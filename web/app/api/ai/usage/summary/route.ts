export const dynamic = 'force-dynamic';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sql, gte } from 'drizzle-orm';
import { jsonResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rows = db.select({
      totalCost: sql<number>`COALESCE(SUM(${schema.aiUsageLogs.costEstimate}), 0)`,
      totalRequests: sql<number>`COUNT(*)`,
      totalTokens: sql<number>`COALESCE(SUM(${schema.aiUsageLogs.totalTokens}), 0)`,
    })
    .from(schema.aiUsageLogs)
    .where(gte(schema.aiUsageLogs.createdAt, startOfMonth))
    .all();

    const row = rows[0];

    return jsonResponse({
      monthToDateCost: row?.totalCost ?? 0,
      totalRequests: row?.totalRequests ?? 0,
      totalTokens: row?.totalTokens ?? 0,
    });
  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
}
