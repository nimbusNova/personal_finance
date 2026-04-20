export const dynamic = 'force-dynamic';
import { getKimiService } from '@/lib/services/kimi';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
export async function DELETE(request: Request, { params }: { params: { fileId: string } }) {
  try { const svc = getKimiService() as any; const resp = await fetch(`${svc.baseUrl}/files/${params.fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${svc.apiKey}` } }); if (!resp.ok) throw new Error(`HTTP ${resp.status}`); return jsonResponse({ message: 'File deleted', file_id: params.fileId }); }
  catch (e: any) { return errorResponse(`Upstream error: ${e.message}`, 502); }
}
