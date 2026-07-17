import { useState, useEffect } from 'react';
import { fetchIpWhitelist, saveIpWhitelist, type IpWhitelistConfig } from '../lib/securityClient';

export default function SecurityTab() {
  const [config, setConfig] = useState<IpWhitelistConfig>({ enabled: false, ips: [] });
  const [newIp, setNewIp] = useState('');
  const [ipError, setIpError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    fetchIpWhitelist()
      .then(setConfig)
      .catch(() => showToast('Failed to load IP whitelist', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isValidIp = (ip: string) => {
    const re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/\d{1,2})?$/;
    if (!re.test(ip)) return false;
    const parts = ip.split('.');
    for (let i = 0; i < 4; i++) {
      const n = parseInt(parts[i]);
      if (n < 0 || n > 255) return false;
    }
    return true;
  };

  const handleAddIp = () => {
    const trimmed = newIp.trim();
    if (!trimmed) return;
    if (!isValidIp(trimmed)) {
      setIpError('Invalid IP format (e.g. 192.168.1.1 or 10.0.0.0/24)');
      return;
    }
    if (config.ips.includes(trimmed)) {
      setIpError('IP already in whitelist');
      return;
    }
    setIpError('');
    setConfig({ ...config, ips: [...config.ips, trimmed] });
    setNewIp('');
  };

  const handleRemoveIp = (ip: string) => {
    setConfig({ ...config, ips: config.ips.filter(i => i !== ip) });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await saveIpWhitelist(config);
      setConfig(updated);
      showToast('IP whitelist saved', 'success');
    } catch (e: any) {
      showToast(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[#9ca3af]">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* IP Whitelist */}
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">IP Whitelist</h2>
            <p className="text-sm text-[#9ca3af] mt-1">
              Restrict API access to trusted IP addresses only
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={() => setConfig({ ...config, enabled: !config.enabled })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-[#2a2a3e] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#6366f1]" />
          </label>
        </div>

        {config.enabled && (
          <>
            {/* Add IP */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1">
                <input
                  value={newIp}
                  onChange={e => { setNewIp(e.target.value); setIpError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddIp()}
                  placeholder="192.168.1.1 or 10.0.0.0/24"
                  className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#6366f1] transition-colors"
                />
                {ipError && <p className="text-red-400 text-xs mt-1">{ipError}</p>}
              </div>
              <button
                onClick={handleAddIp}
                className="bg-[#6366f1] hover:bg-[#5558e6] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
              >
                + Add
              </button>
            </div>

            {/* IP List */}
            {config.ips.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#2a2a3e] rounded-lg">
                <p className="text-[#9ca3af] text-sm">No IPs configured</p>
                <p className="text-[#6b7280] text-xs mt-1">Add your first IP address to enable whitelisting</p>
              </div>
            ) : (
              <div className="space-y-2">
                {config.ips.map(ip => (
                  <div key={ip} className="flex items-center justify-between bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                      <code className="text-sm text-white">{ip}</code>
                      {ip.includes('/') && (
                        <span className="text-xs text-[#9ca3af] bg-[#2a2a3e] px-1.5 py-0.5 rounded">
                          {Number(ip.split('/')[1]) <= 24 ? 'Range' : 'Single'}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveIp(ip)}
                      className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Current IP hint */}
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-amber-400 text-xs">
                ⚠️ Your current IP will be automatically allowed. Make sure to include your own IP in the whitelist to avoid locking yourself out.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Audit Log */}
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6">
        <h2 className="text-lg font-bold mb-2">Audit Log</h2>
        <p className="text-sm text-[#9ca3af] mb-4">
          Key events are logged automatically: login, API key changes, content generation, TTS synthesis, team member changes.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { event: 'login', desc: 'User login' },
            { event: 'login_failed', desc: 'Failed login attempt' },
            { event: 'key_create', desc: 'API key added' },
            { event: 'key_delete', desc: 'API key removed' },
            { event: 'content_generate', desc: 'AI content generated' },
            { event: 'tts_synthesize', desc: 'TTS voice synthesized' },
            { event: 'profile_update', desc: 'Profile changed' },
            { event: 'password_change', desc: 'Password changed' },
            { event: 'team_invite', desc: 'Member invited' },
            { event: 'member_remove', desc: 'Member removed' },
            { event: 'billing_checkout', desc: 'Checkout started' },
            { event: 'billing_upgrade', desc: 'Plan upgraded' },
          ].map(item => (
            <div key={item.event} className="flex items-center gap-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              <div>
                <code className="text-xs text-[#6366f1]">{item.event}</code>
                <p className="text-xs text-[#9ca3af]">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rate Limit Info */}
      <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-6">
        <h2 className="text-lg font-bold mb-2">Rate Limits</h2>
        <p className="text-sm text-[#9ca3af] mb-4">API request limits protect the platform from abuse</p>
        <div className="space-y-3">
          {[
            { label: 'Auth (login/register)', limit: '20/min per IP' },
            { label: 'AI Generation', limit: '10/min per user' },
            { label: 'General API', limit: '100/min per user' },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3">
              <span className="text-sm">{r.label}</span>
              <span className="text-xs font-mono text-[#6366f1] bg-[#2a2a3e] px-2 py-0.5 rounded">{r.limit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Save button (sticky bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#6366f1] hover:bg-[#5558e6] disabled:opacity-50 text-white px-8 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Saving...' : 'Save Security Settings'}
        </button>
      </div>
    </div>
  );
}
