export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse, notFoundResponse } from '@/lib/api-utils';
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const suggestionId = parseInt(params.id);
  const body = await request.json();
  const suggestion = db.select().from(schema.aiSuggestions).where(eq(schema.aiSuggestions.id, suggestionId)).get();
  if (!suggestion) return notFoundResponse('Suggestion not found');
  const isActive = !['accept', 'reject'].includes(body.feedback);
  db.update(schema.aiSuggestions).set({ userFeedback: body.feedback, userNote: body.note || null, isActive }).where(eq(schema.aiSuggestions.id, suggestionId)).run();
  return jsonResponse({ suggestion: { id: suggestionId, user_feedback: body.feedback, user_note: body.note, is_active: isActive } });
}
