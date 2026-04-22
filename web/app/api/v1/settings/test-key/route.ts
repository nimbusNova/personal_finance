export const dynamic = 'force-dynamic';
import { createLLMService } from '@/lib/ai/service';
import { jsonResponse } from '@/lib/api-utils';

export async function POST() {
  try {
    const llm = await createLLMService();
    await llm.generateText({ prompt: 'Say "ok" and nothing else.' });
    return jsonResponse({ valid: true });
  } catch (e: any) {
    return jsonResponse({ valid: false, error: e.message });
  }
}
