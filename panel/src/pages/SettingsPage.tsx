import React, { useState, useEffect } from 'react';
import { useAuth, api } from '../AuthContext';
import { Save, Loader2, CheckCircle2, AlertCircle, ExternalLink, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface Config {
  deepseek_key: string;
  facebook_client_id: string;
  facebook_client_secret: string;
  youtube_client_id: string;
  youtube_client_secret: string;
  reddit_client_id: string;
  reddit_client_secret: string;
  oauth_base_url: string;
  pexels_api_key: string;
  pixabay_api_key: string;
  ark_api_key: string;
  seedance_model_id: string;
}

const DEFAULT_CONFIG: Config = {
  deepseek_key: '',
  facebook_client_id: '',
  facebook_client_secret: '',
  youtube_client_id: '',
  youtube_client_secret: '',
  reddit_client_id: '',
  reddit_client_secret: '',
  oauth_base_url: 'http://43.156.78.59:5288',
  pexels_api_key: '',
  pixabay_api_key: '',
  ark_api_key: '',
  seedance_model_id: '',
};

const OAUTH_HELP = {
  facebook: {
    reg: 'developers.facebook.com → Create App → Facebook Login',
    docs: 'https://developers.facebook.com/docs/facebook-login',
    redirect: '/api/oauth/facebook/callback',
    scopes: 'pages_manage_posts, pages_read_engagement',
  },
  youtube: {
    reg: 'console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID (Web Application)',
    docs: 'https://console.cloud.google.com/apis/credentials',
    redirect: '/api/oauth/youtube/callback',
    scopes: 'https://www.googleapis.com/auth/youtube.upload',
  },
  reddit: {
    reg: 'reddit.com/prefs/apps → create app (type: web app)',
    docs: 'https://www.reddit.com/prefs/apps',
    redirect: '/api/oauth/reddit/callback',
    scopes: 'identity, submit, read',
  },
};

export default function SettingsPage() {
  const { token } = useAuth();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ status: string; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, [token]);

  const loadConfig = async () => {
    if (!token) return;
    try {
      const resp = await api(token).get('/settings');
      if (resp) setConfig({ ...DEFAULT_CONFIG, ...resp });
    } catch {} finally { setLoading(false); }
  };

  const saveSection = async (section: string, data: Record<string, string>) => {
    setSaving(section);
    try {
      await api(token).post('/settings', { section, ...data });
      toast.success(btnLabels[section] || section + ' 已保存');
    } catch (e: any) { toast.error(e.message || '保存失败'); }
    finally { setSaving(null); }
  };

  const testSeedance = async () => {
    if (!config.ark_api_key) return toast.error('请先填写火山引擎 API Key');
    if (!config.seedance_model_id) return toast.error('请先填写 Seedance 模型 ID');
    setTestResult({ status: 'testing', message: '测试中...' });
    try {
      const resp = await api(token).post('/settings/test-seedance', { ark_api_key: config.ark_api_key, model_id: config.seedance_model_id });
      setTestResult(resp);
      if (resp.status === 'ok') toast.success('Seedance API 连接成功！');
      else toast.error(resp.message || '连接失败');
    } catch (e: any) { setTestResult({ status: 'error', message: e.message }); toast.error(e.message); }
  };

  const testDeepSeek = async () => {
    if (!config.deepseek_key) return toast.error('请先填写 DeepSeek API Key');
    setTestResult({ status: 'testing', message: '测试中...' });
    try {
      const resp = await api(token).post('/settings/test-deepseek', { key: config.deepseek_key });
      setTestResult(resp);
      if (resp.status === 'ok') toast.success('DeepSeek API 连接成功！');
      else toast.error(resp.message || '连接失败');
    } catch (e: any) { setTestResult({ status: 'error', message: e.message }); toast.error(e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={32} className="animate-spin text-gray-400" /></div>;

  const set = (k: keyof Config) => (e: React.ChangeEvent<HTMLInputElement>) => setConfig(p => ({ ...p, [k]: e.target.value }));

  const btnLabels: Record<string, string> = {
    llm: '保存 LLM 配置',
    seedance: '保存 Seedance 配置',
    facebook: '保存 Facebook 配置',
    youtube: '保存 YouTube 配置',
    reddit: '保存 Reddit 配置',
    oauth: '保存回调地址',
    medias: '保存素材 API',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">⚙️ 系统配置</h2>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* LLM / DeepSeek */}
        <ConfigCard title="🤖 LLM / AI 文案生成" desc="用于视频脚本生成和文案创作">
          <ConfigRow label="DeepSeek API Key">
            <div className="flex gap-2">
              <input type="password" value={config.deepseek_key} onChange={set('deepseek_key')}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="flex-1 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
              <button onClick={() => saveSection('llm', { deepseek_key: config.deepseek_key })} disabled={saving === 'llm'}
                className="px-4 py-2 bg-accent-primary/50 rounded-lg text-sm hover:bg-accent-primary/70 disabled:opacity-50">
                {saving === 'llm' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={testDeepSeek} className="text-xs px-3 py-1.5 bg-dark-border rounded-lg hover:bg-gray-600">
                测试连接
              </button>
              {testResult && (
                <span className={`text-xs px-2 py-1.5 rounded-lg flex items-center gap-1 ${testResult.status === 'ok' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {testResult.status === 'ok' ? <CheckCircle2 size={12} /> : testResult.status === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
                  {testResult.message}
                </span>
              )}
            </div>
          </ConfigRow>
        </ConfigCard>

        {/* Seedance AI Video Gen */}
        <ConfigCard title="🎬 AI 视频生成 (Seedance)" desc="火山引擎 Seedance 2.0 AI 视频生成。替换 MPTurbo，无需下载素材">
          <ConfigRow label="火山引擎 API Key (ARK_API_KEY)">
            <div className="flex gap-2">
              <input type="password" value={config.ark_api_key} onChange={set('ark_api_key')}
                placeholder="填火山引擎方舟 API Key" className="flex-1 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
              <button onClick={() => saveSection('seedance', { ark_api_key: config.ark_api_key, seedance_model_id: config.seedance_model_id })} disabled={saving === 'seedance'}
                className="px-4 py-2 bg-accent-primary/50 rounded-lg text-sm hover:bg-accent-primary/70 disabled:opacity-50">
                {saving === 'seedance' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              </button>
            </div>
          </ConfigRow>
          <ConfigRow label="Seedance 模型接入点 ID">
            <input type="text" value={config.seedance_model_id} onChange={set('seedance_model_id')}
              placeholder="ep-xxx（方舟控制台 → 模型接入 → 创建接入点）" className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
          </ConfigRow>
          <div className="flex gap-2 mt-3">
            <button onClick={testSeedance} className="text-xs px-3 py-1.5 bg-dark-border rounded-lg hover:bg-gray-600 flex items-center gap-1">
              <ExternalLink size={12} /> 测试连接
            </button>
            <a href="https://console.volcengine.com/ark" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
              <ExternalLink size={12} /> 打开火山引擎方舟
            </a>
          </div>
        </ConfigCard>

        {/* Facebook */}
        <OAuthConfigCard title="📱 Facebook / Meta" platform="facebook" help={OAUTH_HELP.facebook}
          clientId={config.facebook_client_id} clientSecret={config.facebook_client_secret}
          onClientId={set('facebook_client_id')} onClientSecret={set('facebook_client_secret')}
          onSave={() => saveSection('facebook', { facebook_client_id: config.facebook_client_id, facebook_client_secret: config.facebook_client_secret })}
          saving={saving === 'facebook'} baseUrl={config.oauth_base_url} />

        {/* YouTube */}
        <OAuthConfigCard title="▶️ YouTube / Google" platform="youtube" help={OAUTH_HELP.youtube}
          clientId={config.youtube_client_id} clientSecret={config.youtube_client_secret}
          onClientId={set('youtube_client_id')} onClientSecret={set('youtube_client_secret')}
          onSave={() => saveSection('youtube', { youtube_client_id: config.youtube_client_id, youtube_client_secret: config.youtube_client_secret })}
          saving={saving === 'youtube'} baseUrl={config.oauth_base_url} />

        {/* Reddit */}
        <OAuthConfigCard title="🔴 Reddit" platform="reddit" help={OAUTH_HELP.reddit}
          clientId={config.reddit_client_id} clientSecret={config.reddit_client_secret}
          onClientId={set('reddit_client_id')} onClientSecret={set('reddit_client_secret')}
          onSave={() => saveSection('reddit', { reddit_client_id: config.reddit_client_id, reddit_client_secret: config.reddit_client_secret })}
          saving={saving === 'reddit'} baseUrl={config.oauth_base_url} />

        {/* OAuth Base URL */}
        <ConfigCard title="🔗 OAuth 回调地址" desc="各平台 OAuth 授权后重定向的地址">
          <ConfigRow label="Base URL">
            <div className="flex gap-2">
              <input value={config.oauth_base_url} onChange={set('oauth_base_url')}
                className="flex-1 px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm font-mono" />
              <button onClick={() => saveSection('oauth', { oauth_base_url: config.oauth_base_url })} disabled={saving === 'oauth'}
                className="px-4 py-2 bg-accent-primary/50 rounded-lg text-sm hover:bg-accent-primary/70 disabled:opacity-50">
                {saving === 'oauth' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              </button>
            </div>
          </ConfigRow>
        </ConfigCard>

        {/* Pexels / Pixabay */}
        <ConfigCard title="🎬 视频素材 API" desc="用于视频生成时自动下载素材。不填则用内置素材">
          <ConfigRow label="Pexels API Key">
            <input type="password" value={config.pexels_api_key} onChange={set('pexels_api_key')}
              placeholder="留空则跳过 Pexels 素材" className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
          </ConfigRow>
          <ConfigRow label="Pixabay API Key">
            <input type="password" value={config.pixabay_api_key} onChange={set('pixabay_api_key')}
              placeholder="留空则跳过 Pixabay 素材" className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
          </ConfigRow>
          <div className="mt-2">
            <button onClick={() => saveSection('medias', { pexels_api_key: config.pexels_api_key, pixabay_api_key: config.pixabay_api_key })} disabled={saving === 'medias'}
              className="px-4 py-2 bg-accent-primary/50 rounded-lg text-sm hover:bg-accent-primary/70 disabled:opacity-50">
              {saving === 'medias' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存
            </button>
          </div>
        </ConfigCard>
      </div>
    </div>
  );
}

// ── Helper Components ──

function ConfigCard({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden">
      <div className="p-5">
        <div className="mb-4">
          <h3 className="font-semibold text-lg">{title}</h3>
          {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function ConfigRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function OAuthConfigCard({ title, platform, help, clientId, clientSecret, onClientId, onClientSecret, onSave, saving, baseUrl }: {
  title: string; platform: string; help: typeof OAUTH_HELP.facebook;
  clientId: string; clientSecret: string;
  onClientId: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClientSecret: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void; saving: boolean; baseUrl: string;
}) {
  const redirectUri = baseUrl + help.redirect;
  const copyUri = () => { navigator.clipboard.writeText(redirectUri); toast.success('已复制回调地址'); };

  const regUrl = help.docs;

  return (
    <ConfigCard title={title} desc="注册 OAuth App 后填入以下信息">
      <ConfigRow label="Client ID">
        <input type="text" value={clientId} onChange={onClientId}
          placeholder="填 Client ID（在开发者平台获取）" className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
      </ConfigRow>
      <ConfigRow label="Client Secret">
        <input type="password" value={clientSecret} onChange={onClientSecret}
          placeholder="填 Client Secret" className="w-full px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm" />
      </ConfigRow>
      <ConfigRow label="Redirect URI（注册时填入）">
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-xs font-mono break-all">{redirectUri}</code>
          <button onClick={copyUri} className="p-2 text-gray-400 hover:text-white"><Copy size={14} /></button>
          <a href={regUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-400 hover:text-blue-300"><ExternalLink size={14} /></a>
        </div>
      </ConfigRow>
      <ConfigRow label="所需 Scope">
        <code className="text-xs text-gray-400 px-3 py-2 bg-dark-bg rounded-lg block">{help.scopes}</code>
      </ConfigRow>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={onSave} disabled={saving}
          className="px-4 py-2 bg-accent-primary/50 rounded-lg text-sm hover:bg-accent-primary/70 disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存
        </button>
        <a href={regUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
          <ExternalLink size={12} /> {help.reg}
        </a>
      </div>
    </ConfigCard>
  );
}
