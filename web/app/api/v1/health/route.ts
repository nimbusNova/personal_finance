export const dynamic = 'force-dynamic';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() { return jsonResponse({ status: 'healthy', version: '0.1.0', edition: 'sqlite' }); }
