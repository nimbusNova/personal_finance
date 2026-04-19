'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import { listKimiFiles, deleteKimiFile } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { Trash2, Loader2, FileText, AlertCircle, Trash } from 'lucide-react';

const log = createLogger('kimi-files-page');

interface KimiFile {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: string;
  status_details: string;
}

export default function KimiFilesPage() {
  const [files, setFiles] = useState<KimiFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState('');
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listKimiFiles();
      setFiles(data.data || []);
      log.info(`Fetched ${(data.data || []).length} Kimi files`);
    } catch (err: any) {
      log.error(`Failed to list files: ${err.message}`);
      setError(err.message || 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleDelete = async (fileId: string) => {
    if (!confirm(`Delete file ${fileId} from Moonshot?`)) return;
    setDeletingId(fileId);
    try {
      await deleteKimiFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      log.info(`Deleted Kimi file ${fileId}`);
    } catch (err: any) {
      log.error(`Failed to delete file: ${err.message}`);
      setError(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    if (!files.length) return;
    if (!confirm(`Delete all ${files.length} files from Moonshot? This cannot be undone.`)) return;

    setDeletingAll(true);
    setError('');
    let deleted = 0;
    let failed = 0;

    for (const f of files) {
      setDeleteProgress(`Deleting ${deleted + 1} of ${files.length}...`);
      try {
        await deleteKimiFile(f.id);
        deleted++;
        log.info(`Deleted Kimi file ${f.id}`);
      } catch (err: any) {
        failed++;
        log.error(`Failed to delete ${f.id}: ${err.message}`);
      }
      // Remove from UI immediately so user sees progress
      setFiles((prev) => prev.filter((file) => file.id !== f.id));
    }

    setDeletingAll(false);
    setDeleteProgress('');
    if (failed > 0) {
      setError(`Deleted ${deleted} files, ${failed} failed.`);
    }
    log.info(`Bulk delete complete: ${deleted} deleted, ${failed} failed`);
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-white">Kimi File Manager</h1>
            <div className="flex items-center gap-2">
              {files.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition disabled:opacity-40"
                >
                  {deletingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                  Delete All ({files.length})
                </button>
              )}
              <button
                onClick={fetchFiles}
                disabled={loading || deletingAll}
                className="px-3 py-1.5 text-sm font-medium text-primary-300 hover:text-primary-200 hover:bg-primary-900/30 rounded transition disabled:opacity-40"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
              </button>
            </div>
          </div>

          {deleteProgress && (
            <div className="mb-4 p-3 rounded-lg bg-blue-900/30 border border-blue-700 text-blue-400 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {deleteProgress}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {(loading || deletingAll) && files.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : files.length === 0 ? (
            <p className="text-gray-400 text-center py-16">No files found on Moonshot.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                  <tr>
                    <th className="px-4 py-3">Filename</th>
                    <th className="px-4 py-3 w-20">Size</th>
                    <th className="px-4 py-3 w-24 whitespace-nowrap">Created</th>
                    <th className="px-4 py-3 w-20">Status</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id} className="bg-gray-800 border-t border-gray-700">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-white">
                          <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                          <div>
                            <div className="font-medium">{f.filename}</div>
                            <div className="text-xs text-gray-500 font-mono">{f.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{formatBytes(f.bytes)}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(f.created_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                            f.status === 'ok'
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                          }`}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={deletingId === f.id}
                          className="flex items-center justify-center w-8 h-8 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded transition disabled:opacity-40"
                          title="Delete from Moonshot"
                        >
                          {deletingId === f.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
