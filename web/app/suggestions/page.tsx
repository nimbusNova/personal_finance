'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import { getSuggestions, updateSuggestionFeedback } from '@/lib/api';
import { Lightbulb, CheckCircle, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';

interface Suggestion {
  id: number;
  suggestion_type: string;
  action_json: any;
  reasoning_text: string;
  confidence_score: number;
  priority: number;
  user_feedback: string | null;
  is_active: boolean;
  created_at: string;
}

export default function SuggestionsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchSuggestions = async () => {
    try {
      const data = await getSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleFeedback = async (id: number, feedback: string) => {
    setUpdatingId(id);
    try {
      await updateSuggestionFeedback(id, feedback);
      await fetchSuggestions();
    } catch (err: any) {
      setError(err.message || 'Failed to update suggestion');
    } finally {
      setUpdatingId(null);
    }
  };

  const activeSuggestions = suggestions.filter((s) => s.is_active);
  const resolvedSuggestions = suggestions.filter((s) => !s.is_active);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">AI Suggestions</h1>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-400 gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary-400" />
                  Active Suggestions
                  <span className="text-sm font-normal text-gray-400">({activeSuggestions.length})</span>
                </h2>
                {activeSuggestions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeSuggestions.map((s) => (
                      <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onFeedback={handleFeedback}
                        updating={updatingId === s.id}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center">
                    <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No active suggestions right now.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload more statements to get personalized recommendations.
                    </p>
                  </div>
                )}
              </div>

              {resolvedSuggestions.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">Decision Trail</h2>
                  <div className="space-y-3">
                    {resolvedSuggestions.map((s) => (
                      <div
                        key={s.id}
                        className="bg-gray-800 rounded-lg p-4 border border-gray-700 opacity-70"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-white capitalize">
                            {s.suggestion_type}
                          </span>
                          <FeedbackBadge feedback={s.user_feedback} />
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2">{s.reasoning_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}

function SuggestionCard({
  suggestion,
  onFeedback,
  updating,
}: {
  suggestion: Suggestion;
  onFeedback: (id: number, feedback: string) => void;
  updating: boolean;
}) {
  const priorityLabel =
    suggestion.priority >= 8 ? 'High' : suggestion.priority >= 5 ? 'Medium' : 'Low';
  const priorityColor =
    suggestion.priority >= 8
      ? 'bg-red-900/50 text-red-400'
      : suggestion.priority >= 5
      ? 'bg-yellow-900/50 text-yellow-400'
      : 'bg-blue-900/50 text-blue-400';

  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white capitalize">
          {suggestion.suggestion_type}
        </span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityColor}`}>
            {priorityLabel}
          </span>
          <span className="text-xs bg-primary-900/50 text-primary-300 px-2 py-0.5 rounded-full">
            {Math.round((suggestion.confidence_score || 0) * 100)}% confidence
          </span>
        </div>
      </div>

      <p className="text-sm text-gray-300 mb-4 flex-1">{suggestion.reasoning_text}</p>

      {suggestion.action_json && (
        <pre className="text-xs bg-gray-900 rounded p-3 mb-4 text-gray-400 overflow-x-auto">
          {JSON.stringify(suggestion.action_json, null, 2)}
        </pre>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <button
          onClick={() => onFeedback(suggestion.id, 'accept')}
          disabled={updating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          <CheckCircle className="w-4 h-4" />
          Accept
        </button>
        <button
          onClick={() => onFeedback(suggestion.id, 'reject')}
          disabled={updating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Reject
        </button>
        <button
          onClick={() => onFeedback(suggestion.id, 'snooze')}
          disabled={updating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
        >
          <Clock className="w-4 h-4" />
          Snooze
        </button>
        {updating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>
    </div>
  );
}

function FeedbackBadge({ feedback }: { feedback: string | null }) {
  if (!feedback) return null;
  const config: Record<string, { color: string; label: string }> = {
    accept: { color: 'bg-green-900/50 text-green-400', label: 'Accepted' },
    reject: { color: 'bg-red-900/50 text-red-400', label: 'Rejected' },
    snooze: { color: 'bg-yellow-900/50 text-yellow-400', label: 'Snoozed' },
    done: { color: 'bg-blue-900/50 text-blue-400', label: 'Done' },
  };
  const c = config[feedback] || { color: 'bg-gray-700 text-gray-400', label: feedback };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.color}`}>{c.label}</span>
  );
}
