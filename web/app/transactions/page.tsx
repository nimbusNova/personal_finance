'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import { getTransactionSummary, getExpensiveTransactions, getTransactions } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Receipt, AlertCircle, Loader2, TrendingUp } from 'lucide-react';

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

export default function TransactionsPage() {
  const [summary, setSummary] = useState<CategorySummary[]>([]);
  const [expensive, setExpensive] = useState<ExpensiveTransaction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryData, expensiveData] = await Promise.all([
          getTransactionSummary(year, month).catch(() => ({ summary: [] })),
          getExpensiveTransactions().catch(() => ({ transactions: [] })),
        ]);
        setSummary(summaryData.summary || []);
        setExpensive(expensiveData.transactions || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [year, month]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  const chartData = summary.map((s) => ({
    name: s.category || 'Uncategorized',
    total: s.total || 0,
  }));

  const handleCategoryClick = async (category: string) => {
    setSelectedCategory(category);
    setTxLoading(true);
    try {
      const start = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const end = new Date(year, month, 0).toISOString().split('T')[0];
      const data = await getTransactions(undefined, start, end, category);
      setTransactions(data.transactions || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setTxLoading(false);
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
          ) : error ? (
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
                              color: '#fff',
                            }}
                            itemStyle={{ color: '#fff' }}
                            labelStyle={{ color: '#fff' }}
                            formatter={(value: number) => [formatCurrency(value), 'Total']}
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          />
                          <Bar
                            dataKey="total"
                            radius={[0, 4, 4, 0]}
                            onClick={(data: any) => handleCategoryClick(data.name)}
                            className="cursor-pointer"
                          >
                            {chartData.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                className="cursor-pointer hover:opacity-80"
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
                    <h2 className="text-lg font-semibold text-white">Expensive Items</h2>
                  </div>
                  {expensive.length > 0 ? (
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                      {expensive.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{t.merchant}</p>
                            <p className="text-xs text-gray-400">{t.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-white">{formatCurrency(t.amount)}</p>
                            <p className="text-xs text-gray-400">
                              {new Date(t.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                      <TrendingUp className="w-12 h-12 opacity-30" />
                      <p>No expensive transactions found.</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedCategory && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">
                      {selectedCategory} Transactions
                    </h2>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="text-sm text-gray-400 hover:text-white transition"
                    >
                      Close
                    </button>
                  </div>
                  {txLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
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
                            <th className="px-4 py-3 rounded-r-lg">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map((t) => (
                            <tr key={t.id} className="border-b border-gray-700">
                              <td className="px-4 py-3 text-gray-400">
                                {new Date(t.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-white">{t.merchant}</td>
                              <td className="px-4 py-3 text-white font-medium">
                                {formatCurrency(t.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

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
        </main>
      </div>
    </ProtectedRoute>
  );
}
