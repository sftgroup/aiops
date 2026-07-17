import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { adminPost } from '../../lib/admin-api';

export default function OperatorLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminPost('/login', { email, password });
      localStorage.setItem('operator_token', data.token);
      localStorage.setItem('operator_user', JSON.stringify(data.admin));
      navigate('/operator/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%,rgba(99,102,241,0.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(147,51,234,0.06) 0%,transparent 50%),#0f0f1a',
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6366f1] to-purple-600 mb-4 shadow-lg shadow-[#6366f1]/25">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Operator Console</h1>
          <p className="text-sm text-gray-500 mt-2">AIOPS SAAS — 运营管理后台</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] p-8 shadow-xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4 text-gray-600" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
                  style={{ boxShadow: 'none' }}
                  placeholder="admin@aiops.cloud"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-gray-600" />
                </div>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3 bg-[#0f0f1a] border border-[#2a2a3e] rounded-xl text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-[#6366f1]/50 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#6366f1] to-purple-600 rounded-xl text-sm font-semibold text-white hover:shadow-lg hover:shadow-[#6366f1]/25 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-6 flex items-center gap-3">
            <hr className="flex-1 border-[#2a2a3e]" />
            <span className="text-xs text-gray-600">SECURE ACCESS</span>
            <hr className="flex-1 border-[#2a2a3e]" />
          </div>

          {/* Security notice */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-600">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Authorized operator access only</span>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-700">
          &copy; 2026 AIOPS Cloud Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
