import { createLogger } from './logger';

const log = createLogger('api');
const API_BASE_URL = ''; // Same-origin — Next.js API Routes

export async function fetchApi(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = `${API_BASE_URL}${path}`;
  log.debug(`${options.method || 'GET'} ${url}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    let message: string;
    if (Array.isArray(err.detail)) {
      message = err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    } else if (typeof err.detail === 'string') {
      message = err.detail;
    } else {
      message = `Request failed: ${res.status}`;
    }
    log.error(`${options.method || 'GET'} ${url} failed: ${res.status} ${message}`);
    throw new Error(message);
  }

  log.debug(`${options.method || 'GET'} ${url} -> ${res.status}`);
  return res.json();
}

export async function getSettings() {
  return fetchApi('/api/v1/settings');
}

export async function updateSettings(user_name: string, kimi_api_key: string, kimi_base_url?: string) {
  return fetchApi('/api/v1/settings', {
    method: 'POST',
    body: JSON.stringify({ user_name, kimi_api_key, kimi_base_url }),
  });
}

export async function testApiKey() {
  return fetchApi('/api/v1/settings/test-key', {
    method: 'POST',
  });
}

export async function getPortfolioSummary() {
  return fetchApi('/api/v1/portfolio/summary');
}

export async function getHoldings() {
  return fetchApi('/api/v1/holdings');
}

export async function getTransactions(accountId?: number, startDate?: string, endDate?: string, category?: string) {
  const qs = new URLSearchParams();
  if (accountId) qs.append('account_id', String(accountId));
  if (startDate) qs.append('start_date', startDate);
  if (endDate) qs.append('end_date', endDate);
  if (category) qs.append('category', category);
  return fetchApi(`/api/v1/transactions?${qs.toString()}`);
}

export async function getTransactionSummary(year: number, month: number) {
  return fetchApi(`/api/v1/transactions/summary?year=${year}&month=${month}`);
}

export async function getExpensiveTransactions(threshold = 200, days = 30, year?: number, month?: number) {
  let url = `/api/v1/transactions/expensive?threshold=${threshold}&days=${days}`;
  if (year !== undefined) url += `&year=${year}`;
  if (month !== undefined) url += `&month=${month}`;
  return fetchApi(url);
}

export async function getAccounts() {
  return fetchApi('/api/v1/accounts');
}

export async function getRecentTransactions(limit = 10) {
  return fetchApi(`/api/v1/transactions?limit=${limit}`);
}

export async function getSuggestions(isActive = true) {
  return fetchApi(`/api/v1/suggestions?is_active=${isActive}`);
}

export async function updateSuggestionFeedback(id: number, feedback: string, note?: string) {
  return fetchApi(`/api/v1/suggestions/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ feedback, note }),
  });
}

export async function uploadPDF(file: File, accountId?: number) {
  log.info(`Upload started: ${file.name}, size=${file.size}`);
  const formData = new FormData();
  formData.append('file', file);
  if (accountId) formData.append('account_id', String(accountId));

  const res = await fetch(`${API_BASE_URL}/api/v1/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    log.error(`Upload failed: ${err.detail || res.status}`);
    throw new Error(err.detail || 'Upload failed');
  }

  const data = await res.json();
  log.info(`Upload success: pdf_id=${data.pdf_id}`);
  return data;
}

export async function getUploads() {
  return fetchApi('/api/v1/uploads');
}

export async function getUploadById(pdfId: number) {
  return fetchApi(`/api/v1/uploads/${pdfId}`);
}

export async function retryExtraction(pdfId: number) {
  return fetchApi(`/api/v1/uploads/${pdfId}/retry`, {
    method: 'POST',
  });
}

export async function updateExtractedData(pdfId: number, extractedData: any) {
  return fetchApi(`/api/v1/uploads/${pdfId}/extracted-data`, {
    method: 'PATCH',
    body: JSON.stringify({ extracted_data: extractedData }),
  });
}

export async function deleteUpload(pdfId: number) {
  return fetchApi(`/api/v1/uploads/${pdfId}`, {
    method: 'DELETE',
  });
}

export async function listKimiFiles() {
  return fetchApi('/api/v1/kimi-files');
}

export async function deleteKimiFile(fileId: string) {
  return fetchApi(`/api/v1/kimi-files/${fileId}`, {
    method: 'DELETE',
  });
}

export async function updateTransactionCategory(transactionId: number, category: string) {
  return fetchApi(`/api/v1/transactions/${transactionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  });
}
