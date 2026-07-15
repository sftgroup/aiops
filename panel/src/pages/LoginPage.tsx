import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { useAuth } from '../AuthContext';

// EIP-1193 type
interface EthereumProvider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
}

declare global {
  interface Window { ethereum?: EthereumProvider; }
}

export default function LoginPage() {
  const { t } = useTranslation('landing');
  const { walletLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState('');

  /** ── Normal email/password login ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login failed');
      }
      const data = await res.json();
      sessionStorage.setItem('aiops_token', data.token);
      sessionStorage.setItem('aiops_user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /** ── MetaMask wallet login ── */
  const handleWalletLogin = async () => {
    setError('');
    setWalletLoading(true);
    try {
      const provider = window.ethereum;
      if (!provider) {
        throw new Error(t('login.walletNotInstalled', '未检测到 MetaMask，请先安装钱包插件'));
      }

      // 1. Request accounts
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      if (!address) {
        throw new Error(t('login.walletCancelled', '已取消钱包连接'));
      }

      // 2. Get nonce + message from backend
      const nonceRes = await fetch(apiUrl(`/api/auth/wallet-nonce?address=${encodeURIComponent(address)}`));
      if (!nonceRes.ok) {
        const d = await nonceRes.json();
        throw new Error(d.error || '获取 Nonce 失败');
      }
      const { nonce, message } = await nonceRes.json();

      // 3. Request signature from wallet
      const signature: string = await provider.request({
        method: 'personal_sign',
        params: [message, address],
      });

      // 4. Submit to backend
      await walletLogin(address, signature, message, nonce);
      window.location.href = '/dashboard';
    } catch (err: any) {
      if (err.code === 4001) {
        setError(t('login.walletCancelled', '已取消钱包连接'));
      } else {
        setError(err.message || '钱包登录失败');
      }
    } finally {
      setWalletLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <span className="text-2xl font-bold text-white">Aiops</span>
        </Link>
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('login.title', 'Welcome back')}</h1>
          <p className="text-[#9ca3af] mb-6">{t('login.subtitle', 'Sign in to your account')}</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* ── Wallet Login Button ── */}
          <button
            type="button"
            onClick={handleWalletLogin}
            disabled={walletLoading}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 mb-4 flex items-center justify-center gap-2"
          >
            {walletLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            )}
            {walletLoading
              ? t('login.walletLoading', '连接中...')
              : t('login.walletLogin', 'MetaMask 钱包登录')}
          </button>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[#2a2a3e]" />
            <span className="text-xs text-[#6b7280]">{t('login.orEmail', 'OR')}</span>
            <div className="flex-1 h-px bg-[#2a2a3e]" />
          </div>

          {/* ── Email/Password Form ── */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-[#9ca3af] mb-1">{t('login.email', 'Email or Username')}</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9ca3af] mb-1">{t('login.password', 'Password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366f1] hover:bg-[#5558e6] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : t('login.button', 'Sign In')}
            </button>
          </form>

          <p className="text-center text-[#9ca3af] text-sm mt-6">
            {t('login.noAccount', "Don't have an account?")}{' '}
            <Link to="/register" className="text-[#6366f1] hover:text-[#818cf8] transition-colors">
              {t('login.registerLink', 'Sign up')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
