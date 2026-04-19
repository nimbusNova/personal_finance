import { createLogger } from './logger';

const log = createLogger('api');
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function fetchApi(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  log.debug(`${options.method || 'GET'} ${url}`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    log.warn(`Unauthorized: ${url}`);
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // FastAPI validation errors return { detail: [{ msg: '...', loc: [...] }] }
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

export async function login(email: string, password: string) {
  log.info(`Login attempt: ${email}`);
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    log.error(`Login failed: ${err.detail || res.status}`);
    throw new Error(err.detail || 'Login failed');
  }

  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  log.info(`Login success: ${email}`);
  return data;
}

export async function register(email: string, password: string) {
  return fetchApi('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe() {
  return fetchApi('/api/v1/auth/me');
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
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  if (accountId) formData.append('account_id', String(accountId));

  const res = await fetch(`${API_BASE_URL}/api/v1/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });

  if (res.status === 401) {
    log.warn('Upload unauthorized');
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

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
