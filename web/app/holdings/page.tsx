'use client';

import { useEffect, useState, useMemo } from 'react';
import Navbar from '@/app/components/Navbar';
import { usePrivacy } from '@/app/context/PrivacyContext';
import { formatCurrencyPrivate, formatNumber } from '@/lib/formatters';
import { getHoldings } from '@/lib/api';
import { PieChart, AlertCircle, Loader2, ArrowUp, ArrowDown } from 'lucide-react';

interface Holding {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  geography: string;
  quantity: number;
  price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  weight_pct: number;
}

type SortKey = 'quantity' | 'price' | 'market_value' | 'weight_pct';
type SortDir = 'asc' | 'desc';

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('market_value');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [holdings, sortKey, sortDir]);

  const { showAmounts } = usePrivacy();
  const formatCurrency = (val: number) => formatCurrencyPrivate(val, showAmounts);

  const SortHeader = ({ label, sortKey: key }: { label: string; sortKey: SortKey }) => {
    const active = sortKey === key;
    return (
      <th
        className="px-4 py-3 cursor-pointer select-none hover:text-white transition"
        onClick={() => toggleSort(key)}
      >
        <div className="flex items-center gap-1">
          {label}
          {active && (
            sortDir === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-primary-400" />
            ) : (
              <ArrowDown className="w-3 h-3 text-primary-400" />
            )
          )}
        </div>
      </th>
    );
  };

  return (
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
                    <SortHeader label="Quantity" sortKey="quantity" />
                    <SortHeader label="Price" sortKey="price" />
                    <SortHeader label="Market Value" sortKey="market_value" />
                    <SortHeader label="Weight" sortKey="weight_pct" />
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((h) => (
                    <tr key={h.id} className="bg-gray-800 border-t border-gray-700 hover:bg-gray-700/50">
                      <td className="px-4 py-3 font-medium text-white">{h.symbol || '-'}</td>
                      <td className="px-4 py-3 text-gray-300">{h.name || '-'}</td>
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
  );
}
