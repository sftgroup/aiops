import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';

export default function RegisterPage() {
  const { t } = useTranslation('landing');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Register failed');
      }
      const data = await res.json();
      localStorage.setItem('aiops_token', data.token);
      localStorage.setItem('aiops_user', JSON.stringify(data.user));
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <span className="text-2xl font-bold text-white">Aiops</span>
        </Link>
        <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">{t('register.title', 'Create Account')}</h1>
          <p className="text-[#9ca3af] mb-6">{t('register.subtitle', 'Start your free trial')}</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-[#9ca3af] mb-1">{t('register.username', 'Username')}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="yourname"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9ca3af] mb-1">{t('register.email', 'Email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm text-[#9ca3af] mb-1">{t('register.password', 'Password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-[#0f0f1a] border border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-[#6b7280] focus:outline-none focus:border-[#6366f1] transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#6366f1] hover:bg-[#5558e6] text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '...' : t('register.button', 'Create Account')}
            </button>
          </form>

          <p className="text-center text-[#9ca3af] text-sm mt-6">
            {t('register.hasAccount', 'Already have an account?')}{' '}
            <Link to="/login" className="text-[#6366f1] hover:text-[#818cf8] transition-colors">
              {t('register.loginLink', 'Sign in')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
