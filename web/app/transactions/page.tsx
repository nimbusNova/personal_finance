'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import { usePrivacy } from '@/app/context/PrivacyContext';
import { formatCurrencyPrivate } from '@/lib/formatters';
import { getTransactionSummary, getExpensiveTransactions, getTransactions, updateTransactionCategory } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Receipt, AlertCircle, Loader2, TrendingUp, X, HelpCircle } from 'lucide-react';

interface CategorySummary {
  category: string;
  total: number;
  count: number;
}

interface ExpensiveTransaction {
  id: number;
  date: string;
  merchant: string;
  category: string;
  amount: number;
}

interface Transaction {
  id: number;
  account_id: number;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  is_recurring: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return 'An unexpected error occurred';
  }
}

export default function TransactionsPage() {
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [expensive, setExpensive] = useState<ExpensiveTransaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTx, setEditingTx] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const COMMON_CATEGORIES = [
    'Food', 'Transportation', 'Shopping', 'Entertainment',
    'Utilities', 'Healthcare', 'Travel', 'Groceries',
    'Income', 'Transfer', 'Bill Payment', 'Other'
  ];

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const [summaryRes, expensiveRes] = await Promise.all([
          getTransactionSummary(year, month).catch(() => ({ summary: [] })),
          getExpensiveTransactions(200, 30, year, month).catch(() => ({ transactions: [] })),
        ]);
        setSummary(Array.isArray(summaryRes?.summary) ? summaryRes.summary : []);
        setExpensive(Array.isArray(expensiveRes?.transactions) ? expensiveRes.transactions : []);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [year, month]);

  const { showAmounts } = usePrivacy();
  const formatCurrency = (val: number) => formatCurrencyPrivate(val, showAmounts);

  const chartData = summary.map((s) => ({
    name: s.category || 'Uncategorized',
    total: Number(s.total) || 0,
  }));

  const handleCategoryClick = async (category: string) => {
    setSelectedCategory(category);
    setTxLoading(true);
    setError('');
    setEditingTx(null);
    try {
      const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      const data = await getTransactions(undefined, start, end, category);
      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setTxLoading(false);
    }
  };

  const handleSaveCategory = async (txId: number, newCategory: string) => {
    if (!newCategory) return;
    try {
      await updateTransactionCategory(txId, newCategory);
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category: newCategory } : t))
      );
      setEditingTx(null);
      setEditCategory('');
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <h1 className="text-2xl font-bold text-white">Spending</h1>
            <div className="flex items-center gap-3">
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: 5 }, (_, i) => {
                  const y = new Date().getFullYear() - i;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error && !selectedCategory ? (
            <div className="flex items-center justify-center h-64 text-red-400 gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">Spending by Category</h2>
                  {chartData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1f2937',
                              border: '1px solid #374151',
                              borderRadius: '0.5rem',
                            }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: number) => [formatCurrency(value), 'Total']}
                          />
                          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                className="cursor-pointer hover:opacity-80"
                                onClick={() => handleCategoryClick(entry.name)}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <Receipt className="w-12 h-12 opacity-30" />
                      <p>No spending data for this month.</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    <h2 className="text-lg font-semibold text-white">All Transactions</h2>
                    <div className="group relative">
                      <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-48 p-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition pointer-events-none z-10">
                        Transactions ≥ $200 are highlighted in yellow.
                      </div>
                    </div>
                  </div>
                  {expensive.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {expensive.map((t) => {
                        const isExpensive = (t.amount || 0) >= 200;
                        return (
                          <div
                            key={t.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-lg border transition',
                              isExpensive
                                ? 'bg-yellow-900/20 border-yellow-700/50'
                                : 'bg-gray-700/50 border-gray-600'
                            )}
                          >
                            <div>
                              <p className="text-sm font-medium text-white">{t.merchant}</p>
                              <p className="text-xs text-gray-400">{t.category}</p>
                            </div>
                            <div className="text-right">
                              <p className={cn(
                                'text-sm font-medium',
                                isExpensive ? 'text-yellow-400' : 'text-white'
                              )}>
                                {formatCurrency(t.amount)}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(t.date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <TrendingUp className="w-12 h-12 opacity-30" />
                      <p>No transactions found.</p>
                    </div>
                  )}
                </div>
              </div>

              {summary.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <h2 className="text-lg font-semibold text-white mb-4">Category Breakdown</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-3 rounded-l-lg">Category</th>
                          <th className="px-4 py-3">Transactions</th>
                          <th className="px-4 py-3 rounded-r-lg">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.map((s) => (
                          <tr
                            key={s.category}
                            className="border-b border-gray-700 cursor-pointer hover:bg-gray-700/30 transition"
                            onClick={() => handleCategoryClick(s.category)}
                          >
                            <td className="px-4 py-3 text-white">{s.category}</td>
                            <td className="px-4 py-3 text-gray-400">{s.count}</td>
                            <td className="px-4 py-3 text-white font-medium">{formatCurrency(s.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Modal */}
          {selectedCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
              <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                  <h2 className="text-lg font-semibold text-white">
                    {selectedCategory} Transactions
                  </h2>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="p-1 text-gray-400 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto">
                  {txLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center h-32 text-red-400 gap-2">
                      <AlertCircle className="w-5 h-5" />
                      {error}
                    </div>
                  ) : transactions.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">No transactions found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-3 rounded-l-lg">Date</th>
                            <th className="px-4 py-3">Merchant</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3 rounded-r-lg">Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((t) => (
                            <tr
                              key={t.id}
                              className="border-b border-gray-700 hover:bg-gray-700/30 transition"
                            >
                              <td className="px-4 py-3 text-gray-400">
                                {new Date(t.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-white">{t.merchant}</td>
                              <td className="px-4 py-3 text-white font-medium">
                                {formatCurrency(t.amount)}
                              </td>
                              <td className="px-4 py-3">
                                {editingTx === t.id ? (
                                  <select
                                    value={editCategory}
                                    onChange={async (e) => {
                                      const newCat = e.target.value;
                                      if (!newCat) return;
                                      setEditCategory(newCat);
                                      await handleSaveCategory(t.id, newCat);
                                    }}
                                    onBlur={() => setEditingTx(null)}
                                    className="bg-gray-700 border border-gray-600 text-white text-xs rounded px-2 py-1 outline-none"
                                    autoFocus
                                  >
                                    <option value="">Select...</option>
                                    {COMMON_CATEGORIES.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingTx(t.id);
                                      setEditCategory(t.category);
                                    }}
                                    className="text-xs text-primary-300 hover:text-primary-200 hover:underline"
                                  >
                                    {t.category || 'Uncategorized'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
