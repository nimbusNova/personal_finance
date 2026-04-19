'use client';

import { useEffect, useState, useCallback } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import StatCard from '@/app/components/StatCard';
import AllocationChart from '@/app/components/AllocationChart';
import PdfViewerModal from '@/app/components/PdfViewerModal';
import { usePrivacy } from '@/app/context/PrivacyContext';
import { formatCurrencyPrivate } from '@/lib/formatters';
import {
  getPortfolioSummary,
  getSuggestions,
  getUploads,
  getAccounts,
  getTransactions,
  getTransactionSummary,
  retryExtraction,
} from '@/lib/api';
import {
  Wallet,
  TrendingUp,
  Banknote,
  CreditCard,
  FileText,
  Lightbulb,
  AlertCircle,
  Loader2,
  RefreshCw,
  Landmark,
  ArrowRight,
  PieChart as PieChartIcon,
} from 'lucide-react';

interface PortfolioSummary {
  total_value: number;
  cash_balance: number;
  invested_value: number;
  credit_card_debt: number;
  brokerage_total: number;
  bank_total: number;
  account_count: number;
  allocation: Record<string, number>;
  latest_date: string | null;
  accounts: AccountSummary[];
}

interface AccountSummary {
  id: number;
  name: string;
  type: string;
  institution: { id: number; name: string; type: string } | string;
  balance: number | null;
  statement_date: string | null;
}

interface Suggestion {
  id: number;
  suggestion_type: string;
  reasoning_text: string;
  confidence_score: number;
  priority: number;
}

interface Upload {
  id: number;
  original_filename: string;
  file_path: string;
  file_size: number;
  extraction_status: string;
  processing_step?: string;
  created_at: string;
}

interface Transaction {
  id: number;
  account_id: number;
  date: string;
  merchant: string;
  category: string;
  amount: number;
}

interface SpendingItem {
  category: string;
  total: number;
  count: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [spending, setSpending] = useState<SpendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPdfId, setSelectedPdfId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const [
        portfolioData,
        accountsData,
        suggestionsData,
        uploadsData,
        txnsData,
        spendingData,
      ] = await Promise.all([
        getPortfolioSummary().catch(() => null),
        getAccounts().catch(() => ({ accounts: [] })),
        getSuggestions(true).catch(() => ({ suggestions: [] })),
        getUploads().catch(() => ({ uploads: [] })),
        getTransactions().catch(() => ({ transactions: [] })),
        getTransactionSummary(year, month).catch(() => ({ summary: [] })),
      ]);

      setSummary(portfolioData);
      setAccounts(accountsData.accounts || []);
      setSuggestions(suggestionsData.suggestions || []);
      setUploads(uploadsData.uploads || []);
      setTransactions(txnsData.transactions?.slice(0, 10) || []);
      setSpending(spendingData.summary || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh when uploads are processing
  useEffect(() => {
    const hasProcessing = uploads.some((u) => u.extraction_status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [uploads, fetchData]);

  const handleRetry = async (pdfId: number) => {
    setRetryingId(pdfId);
    try {
      await retryExtraction(pdfId);
      await fetchData();
    } catch (err: any) {
      // ignore - state will show failure
    } finally {
      setRetryingId(null);
    }
  };

  const { showAmounts } = usePrivacy();

  const formatCurrency = (val: number) => formatCurrencyPrivate(val, showAmounts);

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const allocationData = summary?.allocation
    ? Object.entries(summary.allocation).map(([name, value]) => ({ name, value }))
    : [];

  const hasAnyData = summary && summary.account_count > 0;
  const hasBrokerage = summary && summary.invested_value > 0;
  const hasCcDebt = summary && (summary.credit_card_debt || 0) > 0;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
                <p className="text-gray-400 text-sm">
                  {summary?.latest_date
                    ? `Latest data as of ${new Date(summary.latest_date).toLocaleDateString()}`
                    : hasAnyData
                    ? 'Upload a brokerage statement to see portfolio allocation.'
                    : 'No data yet. Upload a statement to get started.'}
                </p>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard
                  title="Total Net Worth"
                  value={formatCurrency(summary?.total_value || 0)}
                  masked={!showAmounts}
                  icon={<Wallet className="w-5 h-5" />}
                />
                <StatCard
                  title="Invested"
                  value={formatCurrency(summary?.invested_value || 0)}
                  masked={!showAmounts}
                  icon={<TrendingUp className="w-5 h-5" />}
                />
                <StatCard
                  title="Cash"
                  value={formatCurrency(summary?.cash_balance || 0)}
                  masked={!showAmounts}
                  icon={<Banknote className="w-5 h-5" />}
                />
                {hasCcDebt ? (
                  <StatCard
                    title="Credit Card Debt"
                    value={formatCurrency(summary?.credit_card_debt || 0)}
                    masked={!showAmounts}
                    icon={<CreditCard className="w-5 h-5 text-red-400" />}
                  />
                ) : (
                  <StatCard
                    title="Credit Card Debt"
                    value="$0.00"
                    icon={<CreditCard className="w-5 h-5" />}
                  />
                )}
              </div>

              {/* Allocation + Accounts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Portfolio Allocation */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">Portfolio Allocation</h2>
                  {hasBrokerage && allocationData.length > 0 ? (
                    <AllocationChart data={allocationData} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <PieChartIcon className="w-12 h-12 opacity-30" />
                      <p className="text-sm text-center">
                        {hasAnyData
                          ? 'No brokerage data yet. Upload a brokerage statement to see allocation.'
                          : 'Upload your first statement to see your allocation.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Linked Accounts */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Linked Accounts</h2>
                    <span className="text-xs text-gray-400">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
                  </div>
                  {accounts.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`p-2 rounded-lg ${
                                acc.type === 'brokerage'
                                  ? 'bg-green-900/30 text-green-400'
                                  : acc.type === 'credit_card'
                                  ? 'bg-red-900/30 text-red-400'
                                  : 'bg-blue-900/30 text-blue-400'
                              }`}
                            >
                              <Landmark className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {typeof acc.institution === 'string' ? acc.institution : acc.institution.name}
                              </p>
                              <p className="text-xs text-gray-400 truncate">
                                {acc.name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 ml-3">
                            <p className="text-sm font-semibold text-white">
                              {formatCurrency(acc.balance || 0)}
                            </p>
                            <p className="text-xs text-gray-400">
                              {formatDate(acc.statement_date)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <Landmark className="w-12 h-12 opacity-30" />
                      <p className="text-sm text-center">No accounts linked yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Transactions + Spending */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Recent Transactions */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
                    <a
                      href="/transactions"
                      className="text-xs text-primary-300 hover:text-primary-200 flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                  {transactions.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {transactions.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {t.merchant}
                            </p>
                            <p className="text-xs text-gray-400">
                              {t.category} · {formatDate(t.date)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-white flex-shrink-0 ml-3">
                            {formatCurrency(t.amount)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <FileText className="w-12 h-12 opacity-30" />
                      <p className="text-sm text-center">
                        No transactions yet. Upload a credit card or bank statement.
                      </p>
                    </div>
                  )}
                </div>

                {/* Monthly Spending */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">Monthly Spending</h2>
                  {spending.length > 0 ? (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {spending.map((s) => {
                        const maxTotal = Math.max(...spending.map((x) => x.total));
                        const pct = maxTotal > 0 ? (s.total / maxTotal) * 100 : 0;
                        return (
                          <div key={s.category}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-white">{s.category}</span>
                              <span className="text-sm text-gray-400">
                                {formatCurrency(s.total)} ({s.count})
                              </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2">
                              <div
                                className="bg-primary-500 h-2 rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <PieChartIcon className="w-12 h-12 opacity-30" />
                      <p className="text-sm text-center">
                        No spending data yet. Upload a credit card or bank statement.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Suggestions */}
              {suggestions.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Lightbulb className="w-5 h-5 text-gray-400" />
                    <h2 className="text-lg font-semibold text-white">Active Suggestions</h2>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {suggestions.slice(0, 5).map((s) => (
                      <div
                        key={s.id}
                        className="p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-white capitalize">
                            {s.suggestion_type}
                          </span>
                          <span className="text-xs bg-primary-900/50 text-primary-300 px-2 py-0.5 rounded-full">
                            {Math.round((s.confidence_score || 0) * 100)}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2">{s.reasoning_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Uploads */}
              <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <h2 className="text-lg font-semibold text-white">Recent Uploads</h2>
                </div>
                {uploads.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                        <tr>
                          <th className="px-4 py-3">Filename</th>
                          <th className="px-4 py-3">Size</th>
                          <th className="px-4 py-3">State</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploads.slice(0, 5).map((u) => (
                          <tr key={u.id} className="bg-gray-800 border-t border-gray-700">
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setSelectedPdfId(u.id)}
                                className="flex items-center gap-2 text-white hover:text-primary-300 transition"
                              >
                                <FileText className="w-4 h-4 text-gray-500" />
                                <span className="truncate max-w-[200px]">
                                  {u.original_filename || `Upload #${u.id}`}
                                </span>
                              </button>
                            </td>
                            <td className="px-4 py-3 text-gray-400">{formatSize(u.file_size)}</td>
                            <td className="px-4 py-3">
                              <StepDisplay status={u.extraction_status} step={u.processing_step} />
                            </td>
                            <td className="px-4 py-3 text-gray-400">
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3">
                              {u.extraction_status !== 'processing' && (
                                <button
                                  onClick={() => handleRetry(u.id)}
                                  disabled={retryingId === u.id}
                                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-300 hover:text-primary-200 hover:bg-primary-900/30 rounded transition disabled:opacity-40"
                                  title="Retry extraction"
                                >
                                  {retryingId === u.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Retry
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-400 text-center py-8">No statements uploaded yet.</p>
                )}
              </div>
            </>
          )}
        </main>

        <PdfViewerModal pdfId={selectedPdfId} onClose={() => setSelectedPdfId(null)} />
      </div>
    </ProtectedRoute>
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
