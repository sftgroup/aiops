import { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, Check, X, Save, DollarSign } from 'lucide-react';
import { api } from './lib';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  tokensPerMonth: number;
  contentPerMonth: number;
  ttsPerMonth: number;
  videoPerMonth: number;
  isDefault: boolean;
  sortOrder: number;
  _count?: { tenants: number };
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<Plan>>({
    name: '', displayName: '', description: '', price: 0,
    tokensPerMonth: 0, contentPerMonth: 0, ttsPerMonth: 0, videoPerMonth: 0,
    isDefault: false, sortOrder: 10,
  });

  const fetchPlans = () => {
    setLoading(true);
    api<Plan[]>('/api/operator/plans')
      .then(setPlans)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlans(); }, []);

  const toastMsg = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2000);
  };

  const startCreate = () => {
    setForm({ name: '', displayName: '', description: '', price: 0, tokensPerMonth: 0, contentPerMonth: 0, ttsPerMonth: 0, videoPerMonth: 0, isDefault: false, sortOrder: 10 });
    setCreating(true);
  };

  const startEdit = (p: Plan) => {
    setForm({ ...p });
    setEditingId(p.id);
  };

  const cancelEdit = () => { setEditingId(null); setCreating(false); };

  const handleSave = async (id?: string) => {
    try {
      const payload: any = {
        name: form.name, displayName: form.displayName, description: form.description,
        price: form.price, tokensPerMonth: form.tokensPerMonth, contentPerMonth: form.contentPerMonth,
        ttsPerMonth: form.ttsPerMonth, videoPerMonth: form.videoPerMonth,
        isDefault: form.isDefault, sortOrder: form.sortOrder,
      };
      if (id) {
        await api(`/api/operator/plans/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toastMsg('套餐已更新');
      } else {
        await api('/api/operator/plans', { method: 'POST', body: JSON.stringify(payload) });
        toastMsg('套餐已创建');
      }
      setEditingId(null);
      setCreating(false);
      fetchPlans();
    } catch (e: any) {
      toastMsg(e.message || 'Error', 'error');
    }
  };

  const handleDelete = async (id: string, planName: string) => {
    if (!confirm(`确定删除套餐 "${planName}"？`)) return;
    try {
      await api(`/api/operator/plans/${id}`, { method: 'DELETE' });
      toastMsg('套餐已删除');
      fetchPlans();
    } catch (e: any) {
      toastMsg(e.message || 'Error', 'error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #2a2a3e',
    background: '#0a0a14', color: '#e5e7eb', fontSize: 13, outline: 'none',
  };

  const numberStyle: React.CSSProperties = { ...inputStyle, width: '100%', textAlign: 'right' as const };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e5e7eb', marginBottom: 4 }}>套餐管理</h1>
          <p style={{ fontSize: 13, color: '#9ca3af' }}>{plans.length} 个套餐</p>
        </div>
        {!creating && (
          <button onClick={startCreate} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px',
            borderRadius: 8, border: 'none', background: '#6366f1', color: 'white',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}><Plus size={14} />新建套餐</button>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 100, padding: '10px 20px', borderRadius: 8,
          background: toast.type === 'success' ? '#064e3b' : '#3b1010',
          border: `1px solid ${toast.type === 'success' ? '#065f46' : '#5c1a1a'}`,
          color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5', fontSize: 13,
        }}>{toast.msg}</div>
      )}

      <div style={{ background: '#111122', border: '1px solid #1e1e3a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e3a' }}>
              {['套餐名','描述','价格(¥)','Token/月','内容/月','TTS/月','视频/月','租户数','默认','操作'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Creating new row */}
            {creating && (
              <tr style={{ borderBottom: '1px solid #1e1e3a', background: '#0d0d20' }}>
                <td style={{ padding: '10px 16px' }}><input style={inputStyle} value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} placeholder="free" /></td>
                <td style={{ padding: '10px 16px' }}><input style={inputStyle} value={form.displayName || ''} onChange={e => setForm({...form, displayName: e.target.value})} placeholder="Free" /></td>
                <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.price ?? 0} onChange={e => setForm({...form, price: Number(e.target.value)})} /></td>
                <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.tokensPerMonth ?? 0} onChange={e => setForm({...form, tokensPerMonth: Number(e.target.value)})} /></td>
                <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.contentPerMonth ?? 0} onChange={e => setForm({...form, contentPerMonth: Number(e.target.value)})} /></td>
                <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.ttsPerMonth ?? 0} onChange={e => setForm({...form, ttsPerMonth: Number(e.target.value)})} /></td>
                <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.videoPerMonth ?? 0} onChange={e => setForm({...form, videoPerMonth: Number(e.target.value)})} /></td>
                <td style={{ padding: '10px 16px' }}>-</td>
                <td style={{ padding: '10px 16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isDefault || false} onChange={e => setForm({...form, isDefault: e.target.checked})} />
                    默认
                  </label>
                </td>
                <td style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                  <button onClick={() => handleSave()} title="保存" style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: 4 }}><Check size={16}/></button>
                  <button onClick={cancelEdit} title="取消" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}><X size={16}/></button>
                </td>
              </tr>
            )}

            {/* Existing plans */}
            {plans.map(p => (
              editingId === p.id ? (
                <tr key={p.id} style={{ borderBottom: '1px solid #1e1e3a', background: '#0d0d20' }}>
                  <td style={{ padding: '10px 16px' }}><input style={inputStyle} value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} /></td>
                  <td style={{ padding: '10px 16px' }}><input style={inputStyle} value={form.displayName || ''} onChange={e => setForm({...form, displayName: e.target.value})} /></td>
                  <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.price ?? 0} onChange={e => setForm({...form, price: Number(e.target.value)})} /></td>
                  <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.tokensPerMonth ?? 0} onChange={e => setForm({...form, tokensPerMonth: Number(e.target.value)})} /></td>
                  <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.contentPerMonth ?? 0} onChange={e => setForm({...form, contentPerMonth: Number(e.target.value)})} /></td>
                  <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.ttsPerMonth ?? 0} onChange={e => setForm({...form, ttsPerMonth: Number(e.target.value)})} /></td>
                  <td style={{ padding: '10px 16px' }}><input style={numberStyle} type="number" value={form.videoPerMonth ?? 0} onChange={e => setForm({...form, videoPerMonth: Number(e.target.value)})} /></td>
                  <td style={{ padding: '10px 16px' }}>{p._count?.tenants ?? 0}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#9ca3af', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.isDefault || false} onChange={e => setForm({...form, isDefault: e.target.checked})} />
                      默认
                    </label>
                  </td>
                  <td style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                    <button onClick={() => handleSave(p.id)} title="保存" style={{ background: 'transparent', border: 'none', color: '#6ee7b7', cursor: 'pointer', padding: 4 }}><Save size={16}/></button>
                    <button onClick={cancelEdit} title="取消" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}><X size={16}/></button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} style={{ borderBottom: '1px solid #1e1e3a' }}>
                  <td style={{ padding: '12px 16px', color: '#e5e7eb', fontSize: 13, fontWeight: 500 }}><Package size={12} style={{ marginRight: 6, color: '#6366f1' }} />{p.name}</td>
                  <td style={{ padding: '12px 16px', color: '#e5e7eb', fontSize: 13 }}>{p.displayName}</td>
                  <td style={{ padding: '12px 16px', color: '#fbbf24', fontSize: 13, fontFamily: 'monospace' }}>¥{p.price.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{p.tokensPerMonth.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{p.contentPerMonth.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{p.ttsPerMonth.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13, fontFamily: 'monospace' }}>{p.videoPerMonth.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>{p._count?.tenants ?? 0}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {p.isDefault
                      ? <span style={{ background: '#064e3b', color: '#6ee7b7', padding: '2px 8px', borderRadius: 4, fontSize: 13 }}>默认</span>
                      : <span style={{ color: '#9ca3af', fontSize: 13 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
                    <button onClick={() => startEdit(p)} title="编辑" style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', padding: 4 }}><Edit2 size={14}/></button>
                    <button onClick={() => handleDelete(p.id, p.displayName)} title="删除" style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', padding: 4 }}><Trash2 size={14}/></button>
                  </td>
                </tr>
              )
            ))}
            {!creating && plans.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>暂无套餐</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
