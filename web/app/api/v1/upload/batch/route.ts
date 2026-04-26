export const dynamic = 'force-dynamic';
import { jsonResponse } from '@/lib/api-utils';
export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  const accountIdStr = formData.get('account_id') as string;
  const results: any[] = [];
  for (const file of files) {
    try {
      const uploadForm = new FormData();
      uploadForm.append('file', file);
      if (accountIdStr) uploadForm.append('account_id', accountIdStr);
      const resp = await fetch(new URL('/api/v1/upload', request.url).toString(), { method: 'POST', body: uploadForm });
      const data = await resp.json();
      results.push({ filename: file.name, status: 'success', data });
    } catch (e: any) { results.push({ filename: file.name, status: 'error', error: e.message }); }
  }
  return jsonResponse({ results });
}
