import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';

const PLATFORM_OPTIONS = [
  'twitter', 'youtube', 'tiktok', 'instagram', 'facebook',
  'linkedin', 'threads', 'pinterest',
];

export default function AccountsPage() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [platform, setPlatform] = useState('twitter');
  const [name, setName] = useState('');

  const load = async () => {
    if (!token) return;
    try { setAccounts(await api(token).get('/accounts')); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  const handleAdd = async () => {
    if (!name) return toast.error('请输入账号名称');
    try {
      await api(token!).post('/accounts', { platform, name });
      toast.success('添加成功');
      setShowForm(false);
      setName('');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api(token!).del(`/accounts/${id}`);
      toast.success('已删除');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const getPlatformColor = (p: string) => {
    const colors: Record<string, string> = {
      twitter: 'bg-blue-500/20 text-blue-400',
      youtube: 'bg-red-500/20 text-red-400',
      tiktok: 'bg-gray-500/20 text-gray-400',
      instagram: 'bg-pink-500/20 text-pink-400',
      facebook: 'bg-blue-700/20 text-blue-400',
      linkedin: 'bg-blue-600/20 text-blue-300',
    };
    return colors[p] || 'bg-gray-500/20 text-gray-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">👤 账号管理</h2>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80 transition-colors">
          <Plus size={16} /> 添加账号
        </button>
      </div>

      {showForm && (
        <div className="bg-dark-card rounded-xl p-5 border border-dark-border mb-6 space-y-3">
          <h3 className="font-semibold">添加社交账号</h3>
          <div className="flex gap-3">
            <select
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none"
              value={platform}
              onChange={e => setPlatform(e.target.value)}
            >
              {PLATFORM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input
              className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white focus:outline-none"
              placeholder="账号名称/标识"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button onClick={handleAdd} className="px-4 py-2 bg-accent-primary rounded-lg text-sm font-medium hover:bg-accent-primary/80">确认</button>
          </div>
          <p className="text-xs text-gray-500">⚠️ 实际绑定需要 AiToEarn 授权流程，此操作为记录追踪</p>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500">加载中...</div>
      ) : accounts.length === 0 ? (
        <div className="bg-dark-card rounded-xl p-8 border border-dark-border text-center text-gray-500">暂无账号</div>
      ) : (
        <div className="space-y-2">
          {accounts.map(a => (
            <div key={a.id} className="bg-dark-card rounded-lg p-3 border border-dark-border flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{a.name}</p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${getPlatformColor(a.platform)}`}>
                  {a.platform}
                </span>
              </div>
              <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
