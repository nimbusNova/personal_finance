'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap, Loader2, Clock, Coins, Hash } from 'lucide-react';

interface UsageLog {
  id: number;
  taskType: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  pdfId: number | null;
  createdAt: string;
}

interface UsageSummary {
  monthToDateCost: number;
  totalRequests: number;
  totalTokens: number;
}

export default function UsagePage() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/ai/usage/summary').then((r) => r.json()),
      fetch('/api/ai/usage?limit=50').then((r) => r.json()),
    ])
      .then(([sumData, logData]) => {
        setSummary(sumData);
        setLogs(logData.logs || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by provider for breakdown
  const providerBreakdown = logs.reduce((acc, log) => {
    acc[log.provider] = (acc[log.provider] || 0) + (log.costEstimate || 0);
    return acc;
  }, {} as Record<string, number>);

  // Group by task for breakdown
  const taskBreakdown = logs.reduce((acc, log) => {
    acc[log.taskType] = (acc[log.taskType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">AI Usage</h1>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Coins className="w-4 h-4" />
                  Month-to-Date Cost
                </div>
                <div className="text-2xl font-bold text-white">
                  ${(summary?.monthToDateCost ?? 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Hash className="w-4 h-4" />
                  Total Requests
                </div>
                <div className="text-2xl font-bold text-white">
                  {summary?.totalRequests ?? 0}
                </div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Zap className="w-4 h-4" />
                  Total Tokens
                </div>
                <div className="text-2xl font-bold text-white">
                  {(summary?.totalTokens ?? 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-gray-300 mb-4">Cost by Provider</h2>
                {Object.keys(providerBreakdown).length === 0 ? (
                  <p className="text-sm text-gray-500">No usage data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(providerBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([provider, cost]) => (
                        <div key={provider} className="flex items-center justify-between">
                          <span className="text-sm text-gray-300 capitalize">{provider}</span>
                          <span className="text-sm font-medium text-white">${cost.toFixed(4)}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-gray-300 mb-4">Requests by Task</h2>
                {Object.keys(taskBreakdown).length === 0 ? (
                  <p className="text-sm text-gray-500">No usage data yet.</p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(taskBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([task, count]) => (
                        <div key={task} className="flex items-center justify-between">
                          <span className="text-sm text-gray-300 capitalize">{task.replace('_', ' ')}</span>
                          <span className="text-sm font-medium text-white">{count}</span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent calls table */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-gray-300">Recent Calls</h2>
              </div>
              {logs.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No AI calls recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-700 text-left text-gray-400">
                        <th className="px-4 py-3 font-medium">Task</th>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium">Model</th>
                        <th className="px-4 py-3 font-medium">Tokens</th>
                        <th className="px-4 py-3 font-medium">Cost</th>
                        <th className="px-4 py-3 font-medium">Latency</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="px-4 py-3 text-gray-300 capitalize">{log.taskType.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-gray-300 capitalize">{log.provider}</td>
                          <td className="px-4 py-3 text-gray-300">{log.model}</td>
                          <td className="px-4 py-3 text-gray-300">{(log.totalTokens ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-300">${(log.costEstimate ?? 0).toFixed(4)}</td>
                          <td className="px-4 py-3 text-gray-300">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {log.latencyMs ? `${log.latencyMs}ms` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {log.success ? (
                              <span className="text-green-400 text-xs px-2 py-0.5 bg-green-500/10 rounded">Success</span>
                            ) : (
                              <span className="text-red-400 text-xs px-2 py-0.5 bg-red-500/10 rounded" title={log.errorMessage || ''}>Failed</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
