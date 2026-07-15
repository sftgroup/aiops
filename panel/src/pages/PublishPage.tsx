import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiUrl } from '../lib/api';
import { getToken } from '../token';
import { Send, CheckCircle2, X, Loader2, ExternalLink, Trash2 } from 'lucide-react';

interface Account {
  id: string; platform: string; name: string; screenName?: string;
}

interface Content {
  id: string; type: string; title?: string; body?: string; status: string;
}

interface PublishRecord {
  id: string; accountId: string; platform: string; screenName?: string;
  text?: string; status: string; result?: any; createdAt: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦', facebook: '📘', instagram: '📷', xiaohongshu: '📕',
  tiktok: '🎵', linkedin: '💼',
};

function useAuth() {
  const [token] = useState<string | null>(getToken());
  return { token, isLoggedIn: !!token };
}

export default function PublishPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [contents, setContents] = useState<Content[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [records, setRecords] = useState<PublishRecord[]>([]);
  const [selectedContent, setSelectedContent] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [customText, setCustomText] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resultPopup, setResultPopup] = useState<{ ok: number; fail: number } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!token) { setLoading(false); return; }
    try {
      const [c, a, p] = await Promise.all([
        fetch(apiUrl('/api/content/list?pageSize=100'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(apiUrl('/api/accounts'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(apiUrl('/api/publish/records'), { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setContents(c.items || c || []);
      setAccounts(Array.isArray(a) ? a : []);
      setRecords(Array.isArray(p) ? p : []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handlePublish = async () => {
    if (!selectedContent && !customText.trim()) { setError('Select content or enter text'); return; }
    if (selectedAccounts.length === 0) { setError('Select at least one account'); return; }
    setPublishing(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/api/publish'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          contentId: selectedContent || undefined,
          accountIds: selectedAccounts,
          text: customText.trim() || undefined,
        }),
      });
      const results = await res.json();
      const ok = results.filter((r: any) => r.status === 'published').length;
      const fail = results.filter((r: any) => r.status === 'failed').length;
      setResultPopup({ ok, fail });
      load();
      setSelectedContent('');
      setSelectedAccounts([]);
      setCustomText('');
      setTimeout(() => setResultPopup(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await fetch(apiUrl(`/api/publish/records/${id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      load();
    } catch (e: any) { setError(e.message); }
  };

  const platformGroups = accounts.reduce<Record<string, Account[]>>((groups, acc) => {
    if (!groups[acc.platform]) groups[acc.platform] = [];
    groups[acc.platform].push(acc);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#6366f1]" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-6">📤 {t('pageTitle', '发布管理')}</h2>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm flex items-center gap-2">
          {error}
          <button onClick={() => setError('')} className="hover:text-red-300"><X size={14} /></button>
        </div>
      )}

      {resultPopup && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/20 border border-green-500/30 text-green-400 px-5 py-3 rounded-xl text-sm backdrop-blur-sm">
          Published: {resultPopup.ok} succeeded{resultPopup.fail > 0 ? `, ${resultPopup.fail} failed` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
        {/* Left: Publish Form */}
        <div className="xl:col-span-2 bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e] space-y-4">
          <h3 className="font-semibold text-white">New Publish</h3>

          <div>
            <label className="block text-sm text-[#9ca3af] mb-1.5">Select content (optional)</label>
            <select
              className="w-full px-3 py-2.5 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-white focus:outline-none focus:border-[#6366f1]"
              value={selectedContent}
              onChange={e => { setSelectedContent(e.target.value); setCustomText(''); }}
            >
              <option value="">-- Enter text manually --</option>
              {contents.filter((c: any) => c.status !== 'published').map((c: any) => (
                <option key={c.id} value={c.id}>
                  {(c.title || c.body || 'Untitled').slice(0, 40)} ({c.type || 'text'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[#9ca3af] mb-1.5">Post text</label>
            <textarea
              className="w-full px-3 py-2 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg text-white h-28 resize-none focus:outline-none focus:border-[#6366f1]"
              placeholder="Write your post..."
              value={customText}
              onChange={e => setCustomText(e.target.value)}
              maxLength={280}
            />
            <p className="text-xs text-[#9ca3af] text-right mt-1">{customText.length}/280</p>
          </div>

          <div>
            <label className="block text-sm text-[#9ca3af] mb-1.5">Select accounts</label>
            {Object.keys(platformGroups).length === 0 ? (
              <div className="text-sm text-[#9ca3af] py-2">No accounts connected. Go to Accounts page first.</div>
            ) : (
              <div className="space-y-2">
                {Object.entries(platformGroups).map(([platform, accs]) => (
                  <div key={platform} className="bg-[#0f0f1a] rounded-lg p-3 border border-[#2a2a3e]">
                    <p className="text-xs text-[#9ca3af] mb-2 flex items-center gap-1">
                      {PLATFORM_ICONS[platform] || '🔗'} {platform} <span className="text-gray-600">({accs.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {accs.map(acc => (
                        <button
                          key={acc.id}
                          onClick={() => toggleAccount(acc.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            selectedAccounts.includes(acc.id)
                              ? 'bg-[#6366f1]/20 border-[#6366f1] text-[#6366f1]'
                              : 'bg-[#1a1a2e] border-[#2a2a3e] text-[#9ca3af] hover:border-gray-500'
                          }`}
                        >
                          {selectedAccounts.includes(acc.id) ? '✓ ' : ''}
                          @{acc.screenName || acc.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing || (!selectedContent && !customText.trim()) || selectedAccounts.length === 0}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#6366f1] rounded-lg font-medium text-white hover:bg-[#5558e6] transition-colors disabled:opacity-50"
          >
            {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {publishing ? 'Publishing...' : `Publish to ${selectedAccounts.length} account(s)`}
          </button>
        </div>

        {/* Right: Overview */}
        <div className="bg-[#1a1a2e] rounded-xl p-5 border border-[#2a2a3e] space-y-4">
          <h3 className="font-semibold text-white">Account Overview</h3>
          {Object.keys(platformGroups).length === 0 ? (
            <p className="text-sm text-[#9ca3af]">No accounts yet</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(platformGroups).map(([platform, accs]) => (
                <div key={platform} className="flex items-center justify-between text-sm">
                  <span className="text-white">{PLATFORM_ICONS[platform] || '🔗'} {platform}</span>
                  <span className="text-[#9ca3af]">{accs.length}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[#2a2a3e]">
                <a href="/accounts" className="text-[#6366f1] text-sm hover:underline inline-flex items-center gap-1">
                  <ExternalLink size={12} /> Manage Accounts
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Publish History */}
      <h3 className="font-semibold text-white mb-3">Publish History</h3>
      {records.length === 0 ? (
        <div className="bg-[#1a1a2e] rounded-xl p-8 border border-[#2a2a3e] text-center text-[#9ca3af]">No publish records yet</div>
      ) : (
        <div className="space-y-2">
          {records.slice(0, 20).map(p => (
            <div key={p.id} className="bg-[#1a1a2e] rounded-lg p-3 border border-[#2a2a3e] flex items-start gap-3">
              {p.status === 'published' ? (
                <CheckCircle2 size={18} className="text-green-400 shrink-0 mt-0.5" />
              ) : (
                <X size={18} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {PLATFORM_ICONS[p.platform] || '🔗'} @{p.screenName || p.platform}
                </p>
                <p className="text-xs text-[#9ca3af] mt-0.5">{p.text || '(no text)'}</p>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  {new Date(p.createdAt).toLocaleString()}
                  {p.result?.data?.id ? ` · ID: ${p.result.data.id}` : ''}
                  {p.result?.error ? ` · ${p.result.error}` : ''}
                </p>
              </div>
              <button
                onClick={() => setConfirmDeleteId(p.id)}
                className="text-gray-600 hover:text-red-400 transition-colors shrink-0 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Record</h3>
            <p className="text-[#9ca3af] text-sm mb-6">Are you sure you want to delete this publish record?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 bg-[#2a2a3e] text-white rounded-lg hover:bg-[#3a3a4e] transition-colors text-sm">
                Cancel
              </button>
              <button onClick={handleDelete}
                className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
