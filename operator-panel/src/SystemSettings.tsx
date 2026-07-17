import { useState, useEffect } from 'react';
import { ToggleLeft, ToggleRight, Save, Megaphone, Coins, Share2 } from 'lucide-react';
import { api } from './lib';

interface SystemConfig {
  REGISTRATION_OPEN: string;
  ANNOUNCEMENT: string;
  APP_BASE_URL: string;
  // Twitter
  TWITTER_CONSUMER_KEY: string
  TWITTER_CONSUMER_SECRET: string
  TWITTER_CLIENT_ID: string;
  TWITTER_CLIENT_SECRET: string
  // Facebook
  FACEBOOK_APP_ID: string;
  FACEBOOK_APP_SECRET: string
  // Instagram
  INSTAGRAM_APP_ID: string;
  INSTAGRAM_APP_SECRET: string
  // Xiaohongshu
  XHS_APP_ID: string;
  XHS_APP_SECRET: string
  // TikTok
  TIKTOK_APP_ID: string;
  TIKTOK_APP_SECRET: string
  // LinkedIn
  LINKEDIN_CLIENT_ID: string;
  LINKEDIN_CLIENT_SECRET: string
  // Crypto
  CRYPTO_TOKEN: string
  CRYPTO_TOKEN_ADDRESS: string;
  CRYPTO_CHAIN: string;
  CRYPTO_RPC_URL: string;
  CRYPTO_PAYMENT_ADDRESS: string;
  CRYPTO_MIN_CONFIRMATIONS: string;
}

export default function SystemSettings() {
  const [config, setConfig] = useState<SystemConfig>({
    REGISTRATION_OPEN: 'true',
    ANNOUNCEMENT: '',
    APP_BASE_URL: '',
    TWITTER_CONSUMER_KEY: '',
    TWITTER_CONSUMER_SECRET: '',
    TWITTER_CLIENT_ID: '',
    TWITTER_CLIENT_SECRET: '',
    FACEBOOK_APP_ID: '',
    FACEBOOK_APP_SECRET: '',
    INSTAGRAM_APP_ID: '',
    INSTAGRAM_APP_SECRET: '',
    XHS_APP_ID: '',
    XHS_APP_SECRET: '',
    TIKTOK_APP_ID: '',
    TIKTOK_APP_SECRET: '',
    LINKEDIN_CLIENT_ID: '',
    LINKEDIN_CLIENT_SECRET: '',
    CRYPTO_TOKEN: '***',
    CRYPTO_TOKEN_ADDRESS: '',
    CRYPTO_CHAIN: 'sepolia',
    CRYPTO_RPC_URL: '',
    CRYPTO_PAYMENT_ADDRESS: '',
    CRYPTO_MIN_CONFIRMATIONS: '3',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    api<{ data: SystemConfig }>('/api/operator/settings')
      .then(res => setConfig(res.data))
      .catch(err => { console.error('Settings load error:', err); })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    setSaving({ ...saving, [key]: true });
    try {
      await api('/api/operator/settings', { method: 'PUT', body: JSON.stringify({ [key]: value ? 'true' : 'false' }) });
      setConfig(prev => ({ ...prev, [key]: value ? 'true' : 'false' }));
      setToast({ msg: `${key} 已更新`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSave = async (key: string, value: string) => {
    setSaving({ ...saving, [key]: true });
    try {
      await api('/api/operator/settings', { method: 'PUT', body: JSON.stringify({ [key]: value }) });
      setConfig(prev => ({ ...prev, [key]: value }));
      setToast({ msg: `${key} 已更新`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 13 }}>加载中...</div>;
  }

  const regOpen = config.REGISTRATION_OPEN === 'true';

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>系统设置</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>全局系统配置</p>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 100, padding: '10px 20px', borderRadius: 8,
          background: toast.type === 'success' ? '#064e3b' : '#3b1010',
          border: `1px solid ${toast.type === 'success' ? '#065f46' : '#5c1a1a'}`,
          color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5', fontSize: 13,
        }}>{toast.msg}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Registration */}
        <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Users2Icon size={16} color="#818cf8" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>开放注册</span>
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>{regOpen ? '新用户可以自由注册' : '仅管理员可创建新用户'}</div>
            </div>
            <button onClick={() => handleToggle('REGISTRATION_OPEN', !regOpen)} disabled={saving['REGISTRATION_OPEN']}
              style={{ background: 'none', border: 'none', cursor: saving['REGISTRATION_OPEN'] ? 'not-allowed' : 'pointer', opacity: saving['REGISTRATION_OPEN'] ? 0.5 : 1 }}>
              {regOpen ? <ToggleRight size={40} color="#818cf8" /> : <ToggleLeft size={40} color="#9ca3af" />}
            </button>
          </div>
        </div>

        {/* Announcement */}
        <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Megaphone size={16} color="#f59e0b" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>系统公告</span>
          </div>
          <textarea value={config.ANNOUNCEMENT} onChange={e => setConfig({ ...config, ANNOUNCEMENT: e.target.value })}
            placeholder="输入公告内容..." rows={3} maxLength={500}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a3e', background: '#0a0a14', color: '#e5e7eb', fontSize: 13, outline: 'none', resize: 'vertical' }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button onClick={() => handleSave('ANNOUNCEMENT', config.ANNOUNCEMENT)} disabled={saving['ANNOUNCEMENT']}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 8, border: 'none',
                background: saving['ANNOUNCEMENT'] ? '#1e1e3a' : '#6366f1', color: 'white', fontSize: 13, cursor: saving['ANNOUNCEMENT'] ? 'not-allowed' : 'pointer' }}>
              <Save size={14} />保存
            </button>
          </div>
        </div>

        {/* Social Enterprise Channels */}
        <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Share2 size={16} color="#38bdf8" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>社交平台企业通道</span>
          </div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>
            平台级开发者密钥 — 租户通过企业通道绑定各自账号，无需自行申请开发者资质。
          </p>

          {/* OAuth Base URL */}
          <div style={{ marginBottom: 20 }}>
            <TextField label="OAuth 回调域名" sub="如 https://your-domain.com" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="APP_BASE_URL" full />
          </div>

          {/* Platform cards */}
          {[
            { name: 'Twitter / X', emoji: '🐦', fields: [
              ['TWITTER_CONSUMER_KEY', 'Consumer Key (API Key)', 'OAuth 1.0a'],
              ['TWITTER_CONSUMER_SECRET', 'Consumer Secret (API Secret)', 'OAuth 1.0a'],
              ['TWITTER_CLIENT_ID', 'OAuth 2.0 Client ID', 'OAuth 2.0'],
              ['TWITTER_CLIENT_SECRET', 'OAuth 2.0 Client Secret', 'OAuth 2.0'],
            ]},
            { name: 'Facebook', emoji: '📘', fields: [
              ['FACEBOOK_APP_ID', 'App ID', 'Meta Developer'],
              ['FACEBOOK_APP_SECRET', 'App Secret', 'Meta Developer'],
            ]},
            { name: 'Instagram', emoji: '📷', fields: [
              ['INSTAGRAM_APP_ID', 'App ID', 'Facebook App'],
              ['INSTAGRAM_APP_SECRET', 'App Secret', 'Facebook App'],
            ]},
            { name: '小红书', emoji: '📕', fields: [
              ['XHS_APP_ID', 'App ID', '小红书开放平台'],
              ['XHS_APP_SECRET', 'App Secret', '小红书开放平台'],
            ]},
            { name: 'TikTok', emoji: '🎵', fields: [
              ['TIKTOK_APP_ID', 'App ID', 'TikTok Developer'],
              ['TIKTOK_APP_SECRET', 'App Secret', 'TikTok Developer'],
            ]},
            { name: 'LinkedIn', emoji: '💼', fields: [
              ['LINKEDIN_CLIENT_ID', 'Client ID', 'LinkedIn Developer'],
              ['LINKEDIN_CLIENT_SECRET', 'Client Secret', 'LinkedIn Developer'],
            ]},
          ].map(platform => {
            const hasKeys = platform.fields.some(([key]: string[]) =>
              typeof config[key as keyof SystemConfig] === 'string' && (config[key as keyof SystemConfig] as string).length > 0
            );
            return (
              <div key={platform.name} style={{ marginBottom: 16, border: '1px solid #1e1e3a', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: hasKeys ? '#0a1628' : '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                    {platform.emoji} {platform.name}
                  </span>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: hasKeys ? '#064e3b' : '#1e1e3a',
                    color: hasKeys ? '#6ee7b7' : '#6b7280',
                  }}>{hasKeys ? '已配置' : '未配置'}</span>
                </div>
                <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {platform.fields.map(([key, label, sub]: string[]) => {
                    const isSecret = key.includes('SECRET');
                    return isSecret
                      ? <SecretField key={key} label={label} sub={sub} config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field={key as any} />
                      : <TextField key={key} label={label} sub={sub} config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field={key as any} />;
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ fontSize: 13, color: '#9ca3af', background: '#0a0a14', borderRadius: 8, padding: 12 }}>
            📌 各平台开发者后台填入 OAuth 回调 URL：
            <code style={{ display: 'block', marginTop: 6, color: '#818cf8', fontSize: 12 }}>
              {config.APP_BASE_URL || '{APP_BASE_URL}'}/api/oauth/twitter/callback
            </code>
          </div>
        </div>

        {/* Crypto */}
        <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Coins size={16} color="#f7931a" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>Crypto 支付配置</span>
          </div>
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>Token 配置</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TextField label="Token Symbol" sub="如 TTUSDC, USDC" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="CRYPTO_TOKEN" />
              <TextField label="Chain Network" sub="如 sepolia, mainnet" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="CRYPTO_CHAIN" />
              <TextField label="Token Contract Address" sub="ERC-20 合约地址" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="CRYPTO_TOKEN_ADDRESS" full />
            </div>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af', marginBottom: 10 }}>网络配置</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <TextField label="RPC URL" sub="节点 RPC 地址" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="CRYPTO_RPC_URL" full />
              <TextField label="Payment Address" sub="收款钱包地址" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="CRYPTO_PAYMENT_ADDRESS" full />
              <NumField label="最小确认数" sub="区块确认数" config={config} setConfig={setConfig} saving={saving} handleSave={handleSave} field="CRYPTO_MIN_CONFIRMATIONS" />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Reusable field components ──

function NumField({ label, sub, config, setConfig, saving, handleSave, field }: {
  label: string; sub: string; config: SystemConfig; setConfig: any; saving: Record<string, boolean>; handleSave: any; field: keyof SystemConfig;
}) {
  return (
    <div style={{ background: '#0a0a14', borderRadius: 8, padding: '10px 12px' }}>
      <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{label} <span style={{ color: '#9ca3af' }}>({sub})</span></label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" step="1" min="0" value={config[field] as string}
          onChange={e => setConfig({ ...config, [field]: e.target.value })}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13, outline: 'none', minWidth: 0 }} />
        <button onClick={() => handleSave(field, config[field])} disabled={saving[field]}
          style={{ padding: '0 10px', borderRadius: 6, border: 'none', background: saving[field] ? '#1e1e3a' : '#6366f1', color: 'white', fontSize: 13, cursor: saving[field] ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          {saving[field] ? '...' : '保存'}</button>
      </div>
    </div>
  );
}

function TextField({ label, sub, config, setConfig, saving, handleSave, field, full }: {
  label: string; sub: string; config: SystemConfig; setConfig: any; saving: Record<string, boolean>; handleSave: any; field: keyof SystemConfig; full?: boolean;
}) {
  const style = full ? { gridColumn: '1 / -1' } : {};
  return (
    <div style={{ background: '#0a0a14', borderRadius: 8, padding: '10px 12px', ...style }}>
      <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{label} <span style={{ color: '#9ca3af' }}>({sub})</span></label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="text" value={config[field] as string}
          onChange={e => setConfig({ ...config, [field]: e.target.value })}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13, outline: 'none', minWidth: 0 }} />
        <button onClick={() => handleSave(field, config[field])} disabled={saving[field]}
          style={{ padding: '0 10px', borderRadius: 6, border: 'none', background: saving[field] ? '#1e1e3a' : '#6366f1', color: 'white', fontSize: 13, cursor: saving[field] ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          保存</button>
      </div>
    </div>
  );
}

function SecretField({ label, sub, config, setConfig, saving, handleSave, field, full }: {
  label: string; sub: string; config: SystemConfig; setConfig: any; saving: Record<string, boolean>; handleSave: any; field: keyof SystemConfig; full?: boolean;
}) {
  const style = full ? { gridColumn: '1 / -1' } : {};
  const val = (config[field] as string) || '';
  return (
    <div style={{ background: '#0a0a14', borderRadius: 8, padding: '10px 12px', ...style }}>
      <label style={{ fontSize: 13, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{label} <span style={{ color: '#9ca3af' }}>({sub})</span></label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="password" value={val}
          onChange={e => setConfig({ ...config, [field]: e.target.value })}
          placeholder={val ? '••••••••' : '未配置'}
          style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #2a2a3e', background: '#111122', color: '#e5e7eb', fontSize: 13, outline: 'none', minWidth: 0 }} />
        <button onClick={() => handleSave(field, config[field])} disabled={saving[field]}
          style={{ padding: '0 10px', borderRadius: 6, border: 'none', background: saving[field] ? '#1e1e3a' : '#6366f1', color: 'white', fontSize: 13, cursor: saving[field] ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
          保存</button>
      </div>
    </div>
  );
}

function Users2Icon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
