export const dynamic = 'force-dynamic';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import { jsonResponse } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const logs = db.select()
      .from(schema.aiUsageLogs)
      .orderBy(desc(schema.aiUsageLogs.createdAt))
      .limit(limit)
      .all();

    // Get daily cost rollup
    const daily = db.select({
      day: sql<string>`DATE(${schema.aiUsageLogs.createdAt}, 'unixepoch')`,
      cost: sql<number>`COALESCE(SUM(${schema.aiUsageLogs.costEstimate}), 0)`,
    })
    .from(schema.aiUsageLogs)
    .groupBy(sql`DATE(${schema.aiUsageLogs.createdAt}, 'unixepoch')`)
    .orderBy(desc(sql`DATE(${schema.aiUsageLogs.createdAt}, 'unixepoch')`))
    .limit(30)
    .all();

    return jsonResponse({ logs, daily });
  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
}
