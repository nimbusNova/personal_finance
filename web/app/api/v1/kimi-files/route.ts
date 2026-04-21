export const dynamic = 'force-dynamic';
import { getKimiService } from '@/lib/services/kimi';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
export async function GET() {
  try { const svc = getKimiService() as any; const resp = await fetch(`${svc.baseUrl}/files`, { headers: { Authorization: `Bearer ${svc.apiKey}` } }); if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return jsonResponse(await resp.json()); }
  catch (e: any) { return errorResponse(`Upstream error: ${e.message}`, 502); }
}
