export const dynamic = 'force-dynamic';
import { sqlite } from '@/lib/db/client';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() {
  try {
    const result = sqlite.prepare('SELECT 1').get();
    if (result && (result as any)[1] === 1) return jsonResponse({ status: 'healthy', db: 'connected', edition: 'sqlite' });
    return jsonResponse({ status: 'unhealthy', db: 'error', error: 'Unexpected result' }, 500);
  } catch (e: any) { return jsonResponse({ status: 'unhealthy', db: 'disconnected', error: e.message }, 500); }
}
