'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Save, Loader2, FileText } from 'lucide-react';
import { getUploadById, updateExtractedData } from '@/lib/api';
import { createLogger } from '@/lib/logger';

const log = createLogger('pdf-modal');
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchPdfBlob(pdfId: number): Promise<Blob | null> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE_URL}/api/v1/uploads/${pdfId}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch PDF: ${res.status}`);
  }
  return res.blob();
}

interface PdfViewerModalProps {
  pdfId: number | null;
  onClose: () => void;
}

export default function PdfViewerModal({ pdfId, onClose }: PdfViewerModalProps) {
  const [pdfData, setPdfData] = useState<any>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const fetchPdfData = useCallback(async () => {
    if (!pdfId) return;
    setLoading(true);
    try {
      const [data, blob] = await Promise.all([
        getUploadById(pdfId),
        fetchPdfBlob(pdfId),
      ]);
      setPdfData(data);
      setJsonText(JSON.stringify(data.extracted_data || {}, null, 2));
      setJsonError('');
      setSaveMessage('');
      if (blob) {
        setPdfBlobUrl(URL.createObjectURL(blob));
      }
    } catch (err: any) {
      log.error(`Failed to load PDF data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [pdfId]);

  useEffect(() => {
    if (pdfId) {
      fetchPdfData();
      setZoom(100);
    }
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
    };
  }, [pdfId]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 300));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 25));
  const handleResetZoom = () => setZoom(100);

  const handleSaveJson = async () => {
    if (!pdfId) return;
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
      setJsonError('');
    } catch (e) {
      setJsonError('Invalid JSON');
      return;
    }

    setSaving(true);
    setSaveMessage('');
    try {
      await updateExtractedData(pdfId, parsed);
      setSaveMessage('Saved successfully');
      await fetchPdfData();
    } catch (err: any) {
      log.error(`Save failed: ${err.message}`);
      setSaveMessage(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!pdfId) return null;

  const pdfUrl = `${API_BASE_URL}/api/v1/uploads/${pdfId}/file`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-[95vw] h-[95vh] bg-gray-900 rounded-xl border border-gray-700 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-primary-400 shrink-0" />
            <span className="text-white font-medium truncate">
              {pdfData?.original_filename || `PDF #${pdfId}`}
            </span>
            {pdfData?.extraction_status && (
              <StatusBadge status={pdfData.extraction_status} />
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom controls */}
            <div className="flex items-center bg-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={handleZoomOut}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 transition"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs text-gray-300 font-mono w-12 text-center">
                {zoom}%
              </span>
              <button
                onClick={handleZoomIn}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 transition"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-600 transition border-l border-gray-600"
                title="Reset zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* PDF viewer */}
            <div className="flex-1 bg-gray-950 overflow-auto flex items-start justify-center p-4">
              <div
                style={{
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease',
                  width: zoom >= 100 ? '100%' : `${10000 / zoom}%`,
                  maxWidth: zoom >= 100 ? 'none' : '100%',
                }}
              >
                {pdfBlobUrl ? (
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-[85vh] bg-white rounded shadow-lg"
                    title="PDF Viewer"
                  />
                ) : (
                  <div className="w-full h-[85vh] bg-gray-800 rounded flex items-center justify-center text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mr-3" />
                    Loading PDF...
                  </div>
                )}
              </div>
            </div>

            {/* Side panel - extracted data editor */}
            <div className="w-96 border-l border-gray-700 bg-gray-800 flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-gray-700">
                <h3 className="text-sm font-semibold text-white">AI Extraction Output</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Edit the JSON below to correct extraction errors.
                </p>
              </div>
              <div className="flex-1 p-3 overflow-hidden flex flex-col">
                <textarea
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    setJsonError('');
                    setSaveMessage('');
                  }}
                  className="flex-1 w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-xs font-mono text-green-300 resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  spellCheck={false}
                />
                {jsonError && (
                  <p className="mt-2 text-xs text-red-400">{jsonError}</p>
                )}
                {saveMessage && (
                  <p className={`mt-2 text-xs ${saveMessage.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                    {saveMessage}
                  </p>
                )}
              </div>
              <div className="px-4 py-3 border-t border-gray-700">
                <button
                  onClick={handleSaveJson}
                  disabled={saving}
                  className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Corrections
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'completed'
      ? 'bg-green-900/50 text-green-400'
      : status === 'failed'
      ? 'bg-red-900/50 text-red-400'
      : status === 'processing'
      ? 'bg-yellow-900/50 text-yellow-400'
      : 'bg-gray-700 text-gray-400';

  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {status}
    </span>
  );
}
