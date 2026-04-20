export const dynamic = 'force-dynamic';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isActiveParam = searchParams.get('is_active');
  let suggestions = db.select().from(schema.aiSuggestions).orderBy(desc(schema.aiSuggestions.createdAt)).all();
  if (isActiveParam !== null) suggestions = suggestions.filter(s => s.isActive === (isActiveParam === 'true'));
  return jsonResponse({ suggestions: suggestions.map(s => ({ id: s.id, suggestion_type: s.suggestionType, action_json: s.actionJson, reasoning_text: s.reasoningText, reasoning_json: s.reasoningJson, confidence_score: s.confidenceScore, priority: s.priority, user_feedback: s.userFeedback, user_note: s.userNote, is_active: s.isActive, created_at: s.createdAt })) });
}
