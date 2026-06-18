import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import { LayoutDashboard, Video, FileText, Send, Globe } from 'lucide-react';

interface Stats {
  totalVideos: number; totalTexts: number; published: number;
  pendingPublish: number; accounts: number; platforms: string[];
}

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    api(token).get('/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const cards = [
    { icon: Video, label: '视频', value: stats?.totalVideos || 0, color: 'from-purple-500 to-blue-500' },
    { icon: FileText, label: '文案', value: stats?.totalTexts || 0, color: 'from-green-500 to-teal-500' },
    { icon: Send, label: '已发布', value: stats?.published || 0, color: 'from-orange-500 to-red-500' },
    { icon: LayoutDashboard, label: '待发布', value: stats?.pendingPublish || 0, color: 'from-pink-500 to-rose-500' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">概览</h2>

      {loading ? (
        <div className="text-gray-500">加载中...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {cards.map(c => (
              <div key={c.label} className="bg-dark-card rounded-xl p-4 border border-dark-border">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${c.color} flex items-center justify-center`}>
                    <c.icon size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{c.value}</p>
                    <p className="text-xs text-gray-500">{c.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Globe size={16} /> 绑定平台</h3>
              {stats && stats.platforms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.platforms.map(p => (
                    <span key={p} className="px-3 py-1 bg-dark-hover rounded-full text-sm text-gray-300">{p}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂未绑定任何平台账号</p>
              )}
            </div>

            <div className="bg-dark-card rounded-xl p-5 border border-dark-border">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} /> 账号</h3>
              <p className="text-3xl font-bold text-accent-primary">{stats?.accounts || 0}</p>
              <p className="text-sm text-gray-500 mt-1">已绑定社交账号</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
