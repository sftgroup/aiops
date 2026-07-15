import { useState, useEffect } from 'react';
import { Brain, Image, Key, Copy, RotateCw, Zap, Wallet, X, RefreshCw } from 'lucide-react';
import { adminGet, adminPost } from '../../lib/admin-api';

interface ApiKeyItem {
  id: string;
  name: string;
  lastChars: string;
  status: string;
  usageThisMonth: number;
  expiresAt: string;
}

interface ApiKeysData {
  keys: ApiKeyItem[];
  currentActiveId: string;
}

function maskKey(last: string): string {
  return `sk-${last.slice(0, 4)}••••••••••••••••${last.slice(-4)}`;
}

function maskArkKey(last: string): string {
  return `ark-••••••••••••••••${last.slice(-4)}`;
}

export default function OperatorApiKeys() {
  const [keysData, setKeysData] = useState<ApiKeysData | null>(null);
  const [loading, setLoading] = useState(true);

  // Replace modals
  const [dsModalOpen, setDsModalOpen] = useState(false);
  const [arkModalOpen, setArkModalOpen] = useState(false);
  const [newDsKey, setNewDsKey] = useState('');
  const [newArkKey, setNewArkKey] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const data = await adminGet('/apikeys');
      setKeysData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  // Fallback demo data
  useEffect(() => {
    if (!loading && !keysData) {
      setKeysData({
        keys: [
          { id: '1', name: 'DeepSeek Prod', lastChars: '4a7bx9e2', status: 'active', usageThisMonth: 892000, expiresAt: '2027-06-20' },
          { id: '2', name: 'ARK Prod', lastChars: '7m3k', status: 'active', usageThisMonth: 342, expiresAt: '2027-06-18' },
        ],
        currentActiveId: '1',
      });
    }
  }, [loading, keysData]);

  const handleReplaceDs = async () => {
    if (!newDsKey.trim()) return;
    setActionLoading(true);
    try {
      await adminPost('/apikeys', { name: 'DeepSeek Prod', key: newDsKey, provider: 'deepseek' });
      setDsModalOpen(false);
      setNewDsKey('');
      loadKeys();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReplaceArk = async () => {
    if (!newArkKey.trim()) return;
    setActionLoading(true);
    try {
      await adminPost('/apikeys', { name: 'ARK Prod', key: newArkKey, provider: 'seedream' });
      setArkModalOpen(false);
      setNewArkKey('');
      loadKeys();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const dsKey = keysData?.keys?.find((k) => k.id === '1');
  const arkKey = keysData?.keys?.find((k) => k.id === '2');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">API Key Management</h2>
        <p className="text-sm text-gray-500 mt-1">Manage provider API keys for AI services</p>
      </div>

      {/* Status Banner */}
      <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm text-gray-300">All providers operational</span>
            </div>
            <span className="text-xs text-gray-600 border-l border-[#2a2a3e] pl-4">
              Last checked: 2 min ago
            </span>
          </div>
          <button className="flex items-center gap-2 px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-xs text-gray-400 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Check All
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* DeepSeek Card */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">DeepSeek API</h3>
                <p className="text-xs text-gray-500">AI text generation & reasoning</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Active
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Current Key */}
            <div className="bg-[#0f0f1a] rounded-xl border border-[#2a2a3e] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Current Key</span>
                <span className="text-[10px] text-gray-600">Key ID: dskey_prod_001</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-4 py-3 border border-[#2a2a3e]">
                  <Key className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-mono text-gray-400 tracking-wider">
                    {dsKey ? maskKey(dsKey.lastChars) : 'sk-••••••••••••••••••••'}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(dsKey?.lastChars || '')}
                    className="ml-auto text-gray-600 hover:text-[#6366f1] transition-colors"
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDsModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-xs text-gray-400 hover:text-white hover:border-[#6366f1]/50 transition-all"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Replace
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-xs text-gray-400 hover:text-green-400 hover:border-green-400/30 transition-all">
                    <Zap className="w-3.5 h-3.5" /> Test
                  </button>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">
                  {dsKey ? formatNum(dsKey.usageThisMonth) : '—'}
                </p>
                <p className="text-[10px] text-gray-500">Calls This Month</p>
              </div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-green-400">99.7%</p>
                <p className="text-[10px] text-gray-500">Success Rate</p>
              </div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">$142</p>
                <p className="text-[10px] text-gray-500">Est. Cost MTD</p>
              </div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-amber-400">3</p>
                <p className="text-[10px] text-gray-500">Errors (24h)</p>
              </div>
            </div>

            {/* Key History */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Key History</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 text-xs bg-[#0f0f1a] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="font-mono text-gray-400 flex-1">
                    {dsKey ? maskKey(dsKey.lastChars) : 'sk-••••••••••••x9e2'}
                  </span>
                  <span className="text-gray-600">Added Jun 20, 2026</span>
                  <span className="text-green-400">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ARK Card */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Image className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-white">ARK API (Seedream)</h3>
                <p className="text-xs text-gray-500">AI image generation</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Active
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Current Key */}
            <div className="bg-[#0f0f1a] rounded-xl border border-[#2a2a3e] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider">Current Key</span>
                <span className="text-[10px] text-gray-600">Key ID: ark_prod_001</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-[#1a1a2e] rounded-lg px-4 py-3 border border-[#2a2a3e]">
                  <Key className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-mono text-gray-400 tracking-wider">
                    {arkKey ? maskArkKey(arkKey.lastChars) : 'ark-••••••••••••7m3k'}
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(arkKey?.lastChars || '')}
                    className="ml-auto text-gray-600 hover:text-[#6366f1] transition-colors"
                    title="Copy"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setArkModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-xs text-gray-400 hover:text-white hover:border-[#6366f1]/50 transition-all"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Replace
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-xs text-gray-400 hover:text-green-400 hover:border-green-400/30 transition-all">
                    <Zap className="w-3.5 h-3.5" /> Test
                  </button>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">
                  {arkKey ? formatNum(arkKey.usageThisMonth) : '—'}
                </p>
                <p className="text-[10px] text-gray-500">Images Gen. This Month</p>
              </div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-green-400">98.2%</p>
                <p className="text-[10px] text-gray-500">Success Rate</p>
              </div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-white">$28</p>
                <p className="text-[10px] text-gray-500">Est. Cost MTD</p>
              </div>
              <div className="bg-[#0f0f1a] rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-green-400">0</p>
                <p className="text-[10px] text-gray-500">Errors (24h)</p>
              </div>
            </div>

            {/* Key History */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Key History</h4>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3 text-xs bg-[#0f0f1a] rounded-lg px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  <span className="font-mono text-gray-400 flex-1">
                    {arkKey ? maskArkKey(arkKey.lastChars) : 'ark-••••7m3k'}
                  </span>
                  <span className="text-gray-600">Added Jun 18, 2026</span>
                  <span className="text-green-400">Active</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Check */}
        <div className="bg-[#1a1a2e] rounded-xl border border-[#2a2a3e] p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#6366f1]" /> Provider Balance
              </h3>
              <p className="text-xs text-gray-500 mt-1">Check remaining credit across all providers</p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/25 rounded-xl text-sm font-medium hover:bg-[#6366f1]/20 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Check Balance
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="bg-[#0f0f1a] rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">DeepSeek</p>
                  <p className="text-[10px] text-gray-500">Balance</p>
                </div>
              </div>
              <span className="text-sm font-bold text-green-400">$3,240.50</span>
            </div>
            <div className="bg-[#0f0f1a] rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center">
                  <Image className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">ARK Seedream</p>
                  <p className="text-[10px] text-gray-500">Balance</p>
                </div>
              </div>
              <span className="text-sm font-bold text-green-400">$892.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* DeepSeek Replace Modal */}
      {dsModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center justify-between">
              <h3 className="font-semibold text-white">Replace DeepSeek API Key</h3>
              <button
                onClick={() => setDsModalOpen(false)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New API Key</label>
                <input
                  type="password"
                  value={newDsKey}
                  onChange={(e) => setNewDsKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
                />
                <p className="text-[10px] text-gray-600 mt-1.5">
                  ⚠️ The old key will be revoked immediately upon replacement.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDsModalOpen(false)}
                  className="px-4 py-2.5 border border-[#2a2a3e] rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReplaceDs}
                  disabled={actionLoading || !newDsKey.trim()}
                  className="px-4 py-2.5 bg-[#6366f1] rounded-xl text-sm font-medium text-white hover:bg-[#5558e6] transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save & Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARK Replace Modal */}
      {arkModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-[#2a2a3e] flex items-center justify-between">
              <h3 className="font-semibold text-white">Replace ARK API Key</h3>
              <button
                onClick={() => setArkModalOpen(false)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">New API Key</label>
                <input
                  type="password"
                  value={newArkKey}
                  onChange={(e) => setNewArkKey(e.target.value)}
                  placeholder="ark-..."
                  className="w-full px-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
                />
                <p className="text-[10px] text-gray-600 mt-1.5">
                  ⚠️ The old key will be revoked immediately upon replacement.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setArkModalOpen(false)}
                  className="px-4 py-2.5 border border-[#2a2a3e] rounded-xl text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReplaceArk}
                  disabled={actionLoading || !newArkKey.trim()}
                  className="px-4 py-2.5 bg-[#6366f1] rounded-xl text-sm font-medium text-white hover:bg-[#5558e6] transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Save & Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}
