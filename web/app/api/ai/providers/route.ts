export const dynamic = 'force-dynamic';
import { readProviderConfigs, writeProviderConfigs, type AIProviderConfig } from '@/lib/ai/config';
import { jsonResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const providers = readProviderConfigs();
    return jsonResponse({ providers });
  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const providers = body.providers as AIProviderConfig[];
    if (!Array.isArray(providers)) {
      return jsonResponse({ error: 'Expected providers array' }, 400);
    }
    writeProviderConfigs(providers);
    return jsonResponse({ success: true, providers });
  } catch (e: any) {
    return jsonResponse({ error: e.message }, 500);
  }
}
