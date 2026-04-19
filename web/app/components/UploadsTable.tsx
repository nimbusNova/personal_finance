'use client';

import { FileText, Loader2, RefreshCw } from 'lucide-react';

export interface UploadItem {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  extraction_status: string;
  processing_step?: string;
  created_at: string;
}

interface UploadsTableProps {
  uploads: UploadItem[];
  onSelectPdf?: (id: number) => void;
  onRetry?: (id: number) => void;
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
            <th className="px-4 py-3">Date</th>
            {onRetry && <th className="px-4 py-3"></th>}
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
                    <span className="truncate max-w-[200px]" title={u.original_filename || `Upload #${u.id}`}>
                      {u.original_filename || `Upload #${u.id}`}
                    </span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-white">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="truncate max-w-[200px]" title={u.original_filename || `Upload #${u.id}`}>
                      {u.original_filename || `Upload #${u.id}`}
                    </span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <StepDisplay status={u.extraction_status} step={u.processing_step} />
              </td>
              <td className="px-4 py-3 text-gray-400">
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepDisplay({ status, step }: { status: string; step?: string }) {
  const color =
    status === 'completed'
      ? 'text-green-400'
      : status === 'failed'
      ? 'text-red-400'
      : status === 'processing'
      ? 'text-yellow-400'
      : 'text-gray-400';

  const displayText = step || status;

  return (
    <div className="flex items-center gap-2">
      {status === 'processing' && (
        <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
      )}
      <span className={`text-xs font-medium ${color}`}>{displayText}</span>
    </div>
  );
}
