'use client';

import { FileText, Loader2, RefreshCw, Trash2 } from 'lucide-react';

export interface UploadItem {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  extraction_status: string;
  processing_step?: string;
  provider?: string;
  error_message?: string;
  created_at: string;
}

interface UploadsTableProps {
  uploads: UploadItem[];
  onSelectPdf?: (id: number) => void;
  onRetry?: (id: number) => void;
  onDelete?: (id: number) => void;
  deletingId?: number | null;
  retryingId?: number | null;
  pollingId?: number | null;
  maxItems?: number;
  emptyMessage?: string;
  loading?: boolean;
}

export default function UploadsTable({
  uploads,
  onSelectPdf,
  onRetry,
  onDelete,
  deletingId,
  retryingId,
  pollingId,
  maxItems,
  emptyMessage = 'No uploads yet.',
  loading = false,
}: UploadsTableProps) {
  const displayUploads = maxItems ? uploads.slice(0, maxItems) : uploads;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (displayUploads.length === 0) {
    return <p className="text-gray-400 text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
          <tr>
            <th className="px-4 py-3">Filename</th>
            <th className="px-4 py-3">State</th>
            <th className="px-4 py-3 w-24 whitespace-nowrap">Upload Date</th>
            {onRetry && <th className="px-4 py-3 w-16"></th>}
            {onDelete && <th className="px-4 py-3 w-12"></th>}
          </tr>
        </thead>
        <tbody>
          {displayUploads.map((u) => (
            <tr key={u.id} className="bg-gray-800 border-t border-gray-700">
              <td className="px-4 py-3">
                {onSelectPdf ? (
                  <button
                    onClick={() => onSelectPdf(u.id)}
                    className="flex items-center gap-2 text-white hover:text-primary-300 transition"
                  >
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span title={u.original_filename || `Upload #${u.id}`}>
                      {u.original_filename || `Upload #${u.id}`}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-white">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span title={u.original_filename || `Upload #${u.id}`}>
                      {u.original_filename || `Upload #${u.id}`}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <StepDisplay
                  status={u.extraction_status}
                  step={u.processing_step}
                  error={u.error_message}
                  provider={u.provider}
                />
              </td>
              <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                {new Date(u.created_at).toLocaleDateString()}
              </td>
              {onRetry && (
                <td className="px-4 py-3">
                  {u.extraction_status !== 'processing' && (
                    <button
                      onClick={() => onRetry(u.id)}
                      disabled={retryingId === u.id || pollingId === u.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-300 hover:text-primary-200 hover:bg-primary-900/30 rounded transition disabled:opacity-40"
                      title="Retry extraction"
                    >
                      {retryingId === u.id || pollingId === u.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Retry
                    </button>
                  )}
                </td>
              )}
              {onDelete && (
                <td className="px-4 py-3">
                  <button
                    onClick={() => onDelete(u.id)}
                    disabled={deletingId === u.id || u.extraction_status === 'processing'}
                    className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition disabled:opacity-40"
                    title="Delete upload"
                  >
                    {deletingId === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const STEP_MAP: Record<string, { label: string; pct: number }> = {
  pending: { label: 'Waiting to start…', pct: 0 },
  reading_pdf: { label: 'Reading PDF…', pct: 15 },
  parsing: { label: 'Parsing locally…', pct: 50 },
  classifying: { label: 'Classifying document…', pct: 35 },
  extracting: { label: 'Extracting data with AI…', pct: 55 },
  extracting_holdings: { label: 'Extracting holdings…', pct: 55 },
  extracting_metadata: { label: 'Extracting account info…', pct: 65 },
  repairing_json: { label: 'Repairing JSON…', pct: 70 },
  validating: { label: 'Validating data…', pct: 80 },
  persisting: { label: 'Saving to database…', pct: 90 },
  completed: { label: 'Completed', pct: 100 },
  failed: { label: 'Failed', pct: 0 },
};

function getStepInfo(step?: string, status?: string) {
  const key = step || status || 'pending';
  return STEP_MAP[key] || { label: key, pct: 0 };
}

function isInProgress(status: string, step?: string) {
  if (status === 'processing') return true;
  if (status === 'pending') return true;
  const progressSteps = ['reading_pdf', 'classifying', 'extracting', 'repairing_json', 'validating', 'persisting'];
  return progressSteps.includes(step || '');
}

export function StepDisplay({
  status,
  step,
  error,
  provider,
  showProgress = true,
}: {
  status: string;
  step?: string;
  error?: string;
  provider?: string;
  showProgress?: boolean;
}) {
  const info = getStepInfo(step, status);
  const inProgress = isInProgress(status, step);
  const parsedLocally = status === 'completed' && provider === 'dedicated_parser';

  const color =
    status === 'completed'
      ? 'text-green-400'
      : status === 'failed'
      ? 'text-red-400'
      : inProgress
      ? 'text-yellow-400'
      : 'text-gray-400';

  const barColor =
    status === 'completed'
      ? 'bg-green-500'
      : status === 'failed'
      ? 'bg-red-500'
      : 'bg-yellow-500';

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex items-center gap-2">
        {inProgress && (
          <Loader2 className="w-3 h-3 animate-spin text-yellow-400 flex-shrink-0" />
        )}
        <span className={`text-xs font-medium ${color}`}>{info.label}</span>
        {parsedLocally && (
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/40 whitespace-nowrap"
            title="Parsed without AI — instant and free"
          >
            Parsed locally
          </span>
        )}
      </div>
      {showProgress && inProgress && info.pct > 0 && (
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className={`${barColor} h-1.5 rounded-full transition-all duration-500`}
            style={{ width: `${info.pct}%` }}
          />
        </div>
      )}
      {status === 'failed' && error && (
        <p className="text-[10px] text-red-400/80 truncate" title={error}>
          {error.length > 80 ? error.slice(0, 80) + '…' : error}
        </p>
      )}
    </div>
  );
}
