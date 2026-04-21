export const dynamic = 'force-dynamic';
import { getKimiService } from '@/lib/services/kimi';
import { jsonResponse } from '@/lib/api-utils';
export async function POST() {
  try {
    const svc = getKimiService() as any;
    const resp = await fetch(`${svc.baseUrl}/models`, { headers: { Authorization: `Bearer ${svc.apiKey}` } });
    if (resp.ok) return jsonResponse({ valid: true });
    return jsonResponse({ valid: false, error: `HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}` });
  } catch (e: any) { return jsonResponse({ valid: false, error: e.message }); }
}
