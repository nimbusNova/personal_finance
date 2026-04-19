'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import PdfViewerModal from '@/app/components/PdfViewerModal';
import UploadsTable, { UploadItem } from '@/app/components/UploadsTable';
import { uploadPDF, getUploads, getUploadById, retryExtraction } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { UploadCloud, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

const log = createLogger('upload-page');

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pollingId, setPollingId] = useState<number | null>(null);
  const [pollingStatus, setPollingStatus] = useState('');
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [selectedPdfId, setSelectedPdfId] = useState<number | null>(null);

  const fetchUploads = async () => {
    log.debug('Fetching uploads...');
    try {
      const data = await getUploads();
      log.info(`Fetched ${(data.uploads || []).length} uploads`);
      setUploads(data.uploads || []);
    } catch (err: any) {
      log.error(`Failed to fetch uploads: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type === 'application/pdf');
    if (files.length === 0) {
      setMessage('Please drop PDF files only.');
      return;
    }
    await handleUpload(files[0]);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage('');
    setPollingId(null);
    setPollingStatus('');
    log.info(`Starting upload: ${file.name}`);
    try {
      const result = await uploadPDF(file);
      setMessage('Upload successful! Extraction starting...');
      setPollingId(result.pdf_id);
      await fetchUploads();
    } catch (err: any) {
      log.error(`Upload error: ${err.message}`);
      setMessage(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = async (pdfId: number) => {
    setRetryingId(pdfId);
    setPollingId(null);
    log.info(`Retrying extraction for PDF ${pdfId}`);
    try {
      await retryExtraction(pdfId);
      setPollingId(pdfId);
      await fetchUploads();
    } catch (err: any) {
      log.error(`Retry failed: ${err.message}`);
      setMessage(err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  // Poll extraction status
  useEffect(() => {
    if (!pollingId) return;

    let interval: NodeJS.Timeout;
    const poll = async () => {
      try {
        const data = await getUploadById(pollingId);
        setPollingStatus(data.extraction_status);
        log.debug(`Poll PDF ${pollingId}: status=${data.extraction_status}`);

        if (data.extraction_status === 'completed') {
          setMessage('Upload & extraction complete!');
          await fetchUploads();
          clearInterval(interval);
          setPollingId(null);
        } else if (data.extraction_status === 'failed') {
          setMessage(`Extraction failed: ${data.error_message || 'Unknown error'}`);
          await fetchUploads();
          clearInterval(interval);
          setPollingId(null);
        }
      } catch (err: any) {
        log.error(`Poll error: ${err.message}`);
      }
    };

    poll(); // immediate first check
    interval = setInterval(poll, 3000); // every 3s
    return () => clearInterval(interval);
  }, [pollingId]);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">Upload Statements</h1>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-12 text-center transition
              ${isDragging ? 'border-primary-500 bg-primary-900/10' : 'border-gray-600 bg-gray-800'}
            `}
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-3 pointer-events-none">
              {uploading ? (
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin" />
              ) : (
                <UploadCloud className="w-12 h-12 text-gray-400" />
              )}
              <p className="text-lg font-medium text-white">
                {uploading ? 'Uploading...' : 'Drag & drop your PDF statement'}
              </p>
              <p className="text-sm text-gray-400">or click to browse</p>
              <p className="text-xs text-gray-500">Supports brokerage, credit card, and bank statements</p>
            </div>
          </div>

          {message && (
            <div
              className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                message.includes('failed')
                  ? 'bg-red-900/30 border border-red-700 text-red-400'
                  : message.includes('complete')
                  ? 'bg-green-900/30 border border-green-700 text-green-400'
                  : 'bg-blue-900/30 border border-blue-700 text-blue-400'
              }`}
            >
              {message.includes('failed') ? (
                <AlertCircle className="w-4 h-4" />
              ) : message.includes('complete') ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {message}
              <button onClick={() => setMessage('')} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Uploads</h2>
            <UploadsTable
              uploads={uploads}
              onSelectPdf={(id) => setSelectedPdfId(id)}
              onRetry={handleRetry}
              retryingId={retryingId}
              pollingId={pollingId}
              loading={loading}
              emptyMessage="No uploads yet."
            />
          </div>

          <PdfViewerModal
            pdfId={selectedPdfId}
            onClose={() => setSelectedPdfId(null)}
          />
        </main>
      </div>
    </ProtectedRoute>
  );
}


