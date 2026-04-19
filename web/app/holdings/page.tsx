'use client';

import { useEffect, useState } from 'react';
import ProtectedRoute from '@/app/components/ProtectedRoute';
import Navbar from '@/app/components/Navbar';
import { getHoldings } from '@/lib/api';
import { PieChart, AlertCircle, Loader2 } from 'lucide-react';

interface Holding {
  id: number;
  symbol: string;
  name: string;
  asset_class: string;
  sector: string;
  geography: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  weight_pct: number;
}

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchHoldings() {
      try {
        const data = await getHoldings();
        setHoldings(data.holdings || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load holdings');
      } finally {
        setLoading(false);
      }
    }
    fetchHoldings();
  }, []);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);

  const formatNumber = (val: number) =>
    new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(val || 0);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">Holdings</h1>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64 text-red-400 gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          ) : holdings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
              <PieChart className="w-12 h-12 opacity-30" />
              <p>No holdings found. Upload a brokerage statement to see your positions.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                  <tr>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Asset Class</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Market Value</th>
                    <th className="px-4 py-3">Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.id} className="bg-gray-800 border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium text-white">{h.symbol || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{h.name || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">{h.asset_class || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{formatNumber(h.quantity)}</td>
                      <td className="px-4 py-3 text-gray-300">{formatCurrency(h.price)}</td>
                      <td className="px-4 py-3 text-white font-medium">{formatCurrency(h.market_value)}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {h.weight_pct ? `${h.weight_pct.toFixed(2)}%` : '-'}
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
