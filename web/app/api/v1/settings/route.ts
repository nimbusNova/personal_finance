export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { readSettings, writeSettings } from '@/lib/services/settings';
import { jsonResponse } from '@/lib/api-utils';

export async function GET() {
  const data = readSettings();
  return jsonResponse({
    user_name: data.user_name,
    kimi_api_key: data.kimi_api_key,
    kimi_base_url: data.kimi_base_url,
    has_api_key: !!(data.kimi_api_key || '').trim(),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const updated = writeSettings({
    user_name: body.user_name,
    kimi_api_key: body.kimi_api_key,
    kimi_base_url: body.kimi_base_url,
  });
  return jsonResponse({
    user_name: updated.user_name,
    kimi_api_key: updated.kimi_api_key,
    kimi_base_url: updated.kimi_base_url,
    has_api_key: !!(updated.kimi_api_key || '').trim(),
  });
}
