export const dynamic = 'force-dynamic';
import { desc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { jsonResponse } from '@/lib/api-utils';
export async function GET() {
  const suggestions = db.select().from(schema.aiSuggestions).orderBy(desc(schema.aiSuggestions.createdAt)).all();
  return jsonResponse({ trail: suggestions.map(s => ({ id: s.id, suggestion_type: s.suggestionType, reasoning_text: s.reasoningText, confidence_score: s.confidenceScore, priority: s.priority, user_feedback: s.userFeedback, is_active: s.isActive, created_at: s.createdAt })) });
}
