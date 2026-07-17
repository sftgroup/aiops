import { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { api } from './lib';

interface KeyStatus {
  configured: boolean;
  masked: string | null;
  label: string;
}

const KNOWN_SERVICES = [
  { key: 'deepseek', label: 'DeepSeek', desc: 'DeepSeek AI 文本生成' },
  { key: 'ark', label: 'Ark (豆包)', desc: '字节跳动火山引擎' },
];

export default function ApiKeys() {
  const [keys, setKeys] = useState<Record<string, KeyStatus>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchKeys = () => api<{ data: Record<string, KeyStatus> }>('/api/operator/api-keys')
    .then(res => setKeys(res.data));

  useEffect(() => { fetchKeys().finally(() => setLoading(false)); }, []);

  const handleSave = async (service: string) => {
    const key = values[service];
    if (!key) return;
    try {
      await api('/api/operator/api-keys', {
        method: 'PUT',
        body: JSON.stringify({ service, key }),
      });
      setValues(prev => ({ ...prev, [service]: '' }));
      setToast({ msg: `${service} Key 已保存`, type: 'success' });
      setTimeout(() => setToast(null), 2000);
      fetchKeys();
    } catch (e: any) {
      setToast({ msg: e.message, type: 'error' });
      setTimeout(() => setToast(null), 2500);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', fontSize: 13 }}>加载中...</div>;
  }

  return (
    <div>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 8 }}>API Key 管理</h1>
      <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 32 }}>管理 AI 服务的 API 密钥</p>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 100,
          padding: '10px 20px', borderRadius: 8,
          background: toast.type === 'success' ? '#064e3b' : '#3b1010',
          border: `1px solid ${toast.type === 'success' ? '#065f46' : '#5c1a1a'}`,
          color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontSize: 13, fontWeight: 500,
        }}>{toast.msg}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {KNOWN_SERVICES.map(svc => {
          const k = keys[svc.key];
          return (
            <div key={svc.key} style={{
              background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, padding: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Key size={16} color="#818cf8" />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{svc.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{svc.desc}</div>
                </div>
                {k?.configured ? (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: '#064e3b', color: '#6ee7b7', fontSize: 13,
                    padding: '4px 10px', borderRadius: 20,
                  }}>
                    <CheckCircle size={12} />
                    已配置
                  </span>
                ) : (
                  <span style={{
                    background: '#1e1e3a', color: '#9ca3af', fontSize: 13,
                    padding: '4px 10px', borderRadius: 20,
                  }}>未配置</span>
                )}
              </div>

              {k?.configured && (
                <div style={{ marginBottom: 12, fontSize: 13, color: '#9ca3af' }}>
                  当前: <code style={{ background: '#0a0a14', padding: '2px 6px', borderRadius: 4, color: '#9ca3af' }}>{k.masked}</code>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={visible[svc.key] ? 'text' : 'password'}
                  value={values[svc.key] || ''}
                  onChange={e => setValues({ ...values, [svc.key]: e.target.value })}
                  placeholder={k?.configured ? '输入新 Key 替换...' : '粘贴 API Key...'}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #2a2a3e',
                    background: '#0a0a14', color: '#e5e7eb', fontSize: 13, outline: 'none',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#6366f1'; }}
                  onBlur={e => { e.target.style.borderColor = '#2a2a3e'; }}
                />
                <button
                  onClick={() => setVisible({ ...visible, [svc.key]: !visible[svc.key] })}
                  style={{
                    width: 40, background: '#1e1e3a', border: '1px solid #2a2a3e', borderRadius: 8,
                    color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {visible[svc.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={() => handleSave(svc.key)}
                  disabled={!values[svc.key]}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '0 20px', borderRadius: 8, border: 'none',
                    background: values[svc.key] ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#1e1e3a',
                    color: values[svc.key] ? 'white' : '#6b7280',
                    fontSize: 13, fontWeight: 500, cursor: values[svc.key] ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}
                >
                  <Save size={14} />
                  保存
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
