export const dynamic = 'force-dynamic';
import { getStorageStats } from '@/lib/services/pdf-storage';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() { return jsonResponse(getStorageStats()); }
