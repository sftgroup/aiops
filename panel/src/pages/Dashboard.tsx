import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import { LayoutDashboard, Video, FileText, Send, Globe, Users, X, Loader2, CheckCircle2, Trash2, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

interface Stats {
  totalVideos: number; totalTexts: number; published: number;
  pendingPublish: number; accounts: number; platforms: string[];
}

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tweetTexts, setTweetTexts] = useState<Record<string, string>>({});
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postResult, setPostResult] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const [statsRes, accRes] = await Promise.all([
        api(token).get('/stats'),
        api(token).get('/accounts'),
      ]);
      setStats(statsRes);
      setAccounts(accRes);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [token]);

  // Send tweet
  const handleSendTweet = async (accountId: string) => {
    const text = tweetTexts[accountId]?.trim();
    if (!text) return toast.error('请输入推文内容');
    if (text.length > 280) return toast.error('推文不能超过 280 个字符');

    setPostingId(accountId);
    setPostResult(null);
    try {
      const resp = await api(token!).post('/oauth/twitter/post', { accountId, text });
      if (resp.data?.data?.id) {
        setPostResult(`✅ 已发送 (ID: ${resp.data.data.id})`);
        toast.success('推文发送成功！');
        setTweetTexts(prev => ({ ...prev, [accountId]: '' }));
      } else {
        setPostResult(`❌ 发送失败: ${JSON.stringify(resp.data || resp)}`);
        toast.error('发送失败');
      }
    } catch (e: any) {
      setPostResult(`❌ 发送失败: ${e.message}`);
      toast.error('发送失败');
    } finally { setPostingId(null); }
  };

  // Unbind account
  const handleUnbind = async (id: string, screenName: string) => {
    if (!confirm(`确定解除绑定 @${screenName}？`)) return;
    try {
      await api(token!).del('/accounts/' + id);
      toast.success(`已解除 @${screenName}`);
      load();
    } catch (e: any) {
      toast.error(e.message || '解除绑定失败');
    }
  };

  const twitterAccounts = accounts.filter(a => a.platform === 'twitter');
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
          {/* Stats Cards */}
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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

          {/* Twitter Posting Section */}
          {twitterAccounts.length > 0 && (
            <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
              <div className="p-5 border-b border-dark-border">
                <h3 className="font-semibold flex items-center gap-2">
                  🐦 Twitter / X — 手动发推
                </h3>
              </div>
              <div className="divide-y divide-dark-border">
                {twitterAccounts.map(acc => (
                  <div key={acc.id} className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-medium text-sm">@{acc.screenName}</span>
                        <span className="text-xs text-gray-500">• {new Date(acc.createdAt).toLocaleDateString('zh-CN')} 绑定</span>
                      </div>
                      <button
                        onClick={() => handleUnbind(acc.id, acc.screenName)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut size={12} />
                        解除绑定
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="输入推文内容（最多 280 字符）..."
                        value={tweetTexts[acc.id] || ''}
                        onChange={e => setTweetTexts(prev => ({ ...prev, [acc.id]: e.target.value }))}
                        maxLength={280}
                        className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                        onKeyDown={e => e.key === 'Enter' && handleSendTweet(acc.id)}
                      />
                      <button
                        onClick={() => handleSendTweet(acc.id)}
                        disabled={postingId === acc.id}
                        className="px-4 py-2 bg-blue-500 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {postingId === acc.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        发送
                      </button>
                    </div>

                    {tweetTexts[acc.id] && tweetTexts[acc.id].length > 0 && (
                      <p className="text-xs text-gray-500 mt-1 text-right">
                        {tweetTexts[acc.id].length}/280
                      </p>
                    )}

                    {postResult && postingId === acc.id && (
                      <p className="text-xs mt-1">{postResult}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
