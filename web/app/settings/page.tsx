'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSettings, updateSettings, testApiKey } from '@/lib/api';
import {
  Settings, Loader2, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft,
  Plus, Trash2, TestTube, Zap, ShieldAlert
} from 'lucide-react';

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'kimi', label: 'Moonshot (Kimi)' },
  { value: 'groq', label: 'Groq' },
  { value: 'ollama', label: 'Ollama (Local)' },
];

const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-2.0-flash',
  kimi: 'moonshot-v1-128k',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
};

interface ProviderConfig {
  name: string;
  provider: string;
  apiKey: string;
  baseURL: string;
  defaultModel: string;
  isActive: boolean;
  isFallback: boolean;
  priority: number;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'providers'>('general');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Providers
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState<Partial<ProviderConfig>>({
    provider: 'openai',
    isActive: true,
    isFallback: false,
    priority: 1,
  });
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ name: string; valid: boolean; error?: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSettings().then((d) => setName(d.user_name || '')).catch(() => {}),
      fetch('/api/ai/providers')
        .then((r) => r.json())
        .then((d) => setProviders(d.providers || []))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    try {
      await updateSettings(name.trim(), '', '');
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProviders = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/ai/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('Providers saved successfully');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(data.error || 'Failed to save providers');
      }
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to save providers');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (providerName?: string) => {
    setTestingProvider(providerName || 'default');
    setTestResult(null);
    try {
      const result = await testApiKey();
      setTestResult({ name: providerName || 'Configured provider', ...result });
    } catch (err: any) {
      setTestResult({ name: providerName || 'Configured provider', valid: false, error: err.message });
    } finally {
      setTestingProvider(null);
    }
  };

  const addProvider = () => {
    if (!newProvider.name || !newProvider.apiKey) return;
    const p: ProviderConfig = {
      name: newProvider.name,
      provider: newProvider.provider || 'openai',
      apiKey: newProvider.apiKey,
      baseURL: newProvider.baseURL || '',
      defaultModel: newProvider.defaultModel || DEFAULT_MODELS[newProvider.provider || 'openai'],
      isActive: newProvider.isActive ?? true,
      isFallback: newProvider.isFallback ?? false,
      priority: newProvider.priority || 1,
    };
    setProviders([...providers, p]);
    setShowAddForm(false);
    setNewProvider({ provider: 'openai', isActive: true, isFallback: false, priority: 1 });
  };

  const removeProvider = (idx: number) => {
    setProviders(providers.filter((_, i) => i !== idx));
  };

  const updateProvider = (idx: number, patch: Partial<ProviderConfig>) => {
    setProviders(providers.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-700">
            <div className="flex items-center gap-3">
              <Settings className="w-6 h-6 text-primary-500" />
              <h1 className="text-2xl font-bold text-white">Settings</h1>
            </div>
          </div>

          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'general'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('providers')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'providers'
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              AI Providers
            </button>
          </div>

          <div className="p-6">
            {saveMessage && (
              <div
                className={`mb-4 p-3 rounded-md text-sm ${
                  saveMessage.includes('success')
                    ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-red-500/10 border border-red-500/20 text-red-400'
                }`}
              >
                {saveMessage}
              </div>
            )}

            {activeTab === 'general' && (
              <form onSubmit={handleSaveName} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Michael"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save
                </button>
              </form>
            )}

            {activeTab === 'providers' && (
              <div className="space-y-6">
                {providers.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-sm text-yellow-400 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    No AI providers configured. Add one below to enable document extraction.
                  </div>
                )}

                <div className="space-y-3">
                  {providers.map((p, idx) => (
                    <div key={idx} className="p-4 bg-gray-700/50 border border-gray-600 rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary-400" />
                          <span className="font-medium text-white">{p.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-600 rounded text-gray-300">{p.provider}</span>
                          {!p.isFallback && (
                            <span className="text-xs px-2 py-0.5 bg-primary-500/20 rounded text-primary-400">Primary</span>
                          )}
                          {p.isFallback && (
                            <span className="text-xs px-2 py-0.5 bg-orange-500/20 rounded text-orange-400">Fallback</span>
                          )}
                        </div>
                        <button
                          onClick={() => removeProvider(idx)}
                          className="text-gray-400 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <input
                          type="password"
                          value={p.apiKey}
                          onChange={(e) => updateProvider(idx, { apiKey: e.target.value })}
                          placeholder="API Key"
                          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="text"
                          value={p.defaultModel}
                          onChange={(e) => updateProvider(idx, { defaultModel: e.target.value })}
                          placeholder="Model"
                          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <input
                          type="text"
                          value={p.baseURL}
                          onChange={(e) => updateProvider(idx, { baseURL: e.target.value })}
                          placeholder="Base URL (optional)"
                          className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                        <div className="flex items-center gap-3 text-sm">
                          <label className="flex items-center gap-1 text-gray-300">
                            <input
                              type="checkbox"
                              checked={p.isActive}
                              onChange={(e) => updateProvider(idx, { isActive: e.target.checked })}
                              className="rounded border-gray-600"
                            />
                            Active
                          </label>
                          <label className="flex items-center gap-1 text-gray-300">
                            <input
                              type="checkbox"
                              checked={p.isFallback}
                              onChange={(e) => updateProvider(idx, { isFallback: e.target.checked })}
                              className="rounded border-gray-600"
                            />
                            Fallback
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {showAddForm ? (
                  <div className="p-4 bg-gray-700/50 border border-gray-600 rounded-md space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={newProvider.name || ''}
                        onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                        placeholder="Provider name (e.g. primary-openai)"
                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <select
                        value={newProvider.provider || 'openai'}
                        onChange={(e) =>
                          setNewProvider({
                            ...newProvider,
                            provider: e.target.value,
                            defaultModel: DEFAULT_MODELS[e.target.value],
                          })
                        }
                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {PROVIDER_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="password"
                        value={newProvider.apiKey || ''}
                        onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                        placeholder="API Key"
                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="text"
                        value={newProvider.defaultModel || ''}
                        onChange={(e) => setNewProvider({ ...newProvider, defaultModel: e.target.value })}
                        placeholder="Model (e.g. gpt-4o-mini)"
                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="text"
                        value={newProvider.baseURL || ''}
                        onChange={(e) => setNewProvider({ ...newProvider, baseURL: e.target.value })}
                        placeholder="Base URL (optional)"
                        className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <div className="flex items-center gap-3 text-sm">
                        <label className="flex items-center gap-1 text-gray-300">
                          <input
                            type="checkbox"
                            checked={newProvider.isFallback || false}
                            onChange={(e) => setNewProvider({ ...newProvider, isFallback: e.target.checked })}
                            className="rounded border-gray-600"
                          />
                          Fallback
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={addProvider}
                        className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-md transition"
                      >
                        Add Provider
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition"
                  >
                    <Plus className="w-4 h-4" />
                    Add Provider
                  </button>
                )}

                {testResult && (
                  <div
                    className={`p-3 rounded-md text-sm flex items-center gap-2 ${
                      testResult.valid
                        ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {testResult.valid ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {testResult.valid
                      ? `${testResult.name}: API key is valid`
                      : `${testResult.name}: ${testResult.error || 'Test failed'}`}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveProviders}
                    disabled={saving}
                    className="px-6 py-2.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Providers
                  </button>
                  <button
                    onClick={() => handleTest()}
                    disabled={testingProvider !== null || providers.length === 0}
                    className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-md transition flex items-center gap-2"
                  >
                    {testingProvider !== null && <Loader2 className="w-4 h-4 animate-spin" />}
                    <TestTube className="w-4 h-4" />
                    Test Key
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
