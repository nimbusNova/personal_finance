export const dynamic = 'force-dynamic';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const snapshotId = searchParams.get('snapshot_id');
  const accountId = searchParams.get('account_id');
  let holdings: any[] = [];
  if (snapshotId) holdings = db.select().from(schema.holdings).where(eq(schema.holdings.snapshotId, parseInt(snapshotId))).all();
  else if (accountId) {
    const snapshots = db.select().from(schema.portfolioSnapshots).where(eq(schema.portfolioSnapshots.accountId, parseInt(accountId))).all();
    const ids = snapshots.map(s => s.id);
    if (ids.length) holdings = db.select().from(schema.holdings).where(inArray(schema.holdings.snapshotId, ids)).all();
  } else holdings = db.select().from(schema.holdings).all();
  const totalMv = holdings.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  return jsonResponse({ holdings: holdings.map(h => ({ id: h.id, snapshot_id: h.snapshotId, symbol: h.symbol, name: h.name, asset_class: h.assetClass, sector: h.sector, geography: h.geography, quantity: h.quantity, price: h.price, market_value: h.marketValue, cost_basis: h.costBasis, unrealized_pnl: h.unrealizedPnl, weight_pct: totalMv > 0 ? Math.round((h.marketValue / totalMv) * 10000) / 100 : h.weightPct, is_manual_correction: h.isManualCorrection })) });
}
