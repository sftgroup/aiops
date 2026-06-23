import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isRegister) {
        await register(username, password);
        toast.success('注册成功');
      } else {
        await login(username, password);
        toast.success('登录成功');
      }
      navigate('/');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">🤖 Aiops</h1>
          <p className="text-gray-500 mt-2">AI 内容运营平台</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-dark-card rounded-xl p-6 border border-dark-border space-y-4">
          <h2 className="text-lg font-semibold">{isRegister ? '注册' : '登录'}</h2>
          <input
            className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
            placeholder="用户名"
            aria-label="用户名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            className="w-full px-3 py-2.5 bg-dark-bg border border-dark-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent-primary"
            placeholder="密码"
            aria-label="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent-primary hover:bg-accent-primary/80 rounded-lg font-medium transition-colors disabled:opacity-50"
            aria-label={loading ? '处理中' : isRegister ? '注册' : '登录'}
          >
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-sm text-gray-500 hover:text-accent-primary transition-colors"
            aria-label={isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          >
            {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
          </button>
        </form>
      </div>
    </div>
  );
}
