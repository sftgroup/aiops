import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, Video, FileText, Users, Settings, LogOut } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const links = [
    { to: '/', icon: LayoutDashboard, label: '概览' },
    { to: '/teams', icon: Users, label: '运营团队' },
    { to: '/videos', icon: Video, label: '视频制作' },
    { to: '/content', icon: FileText, label: '文案生成' },
    { to: '/accounts', icon: Users, label: '账号管理' },
    { to: '/settings', icon: Settings, label: '系统配置' },
  ];

  const bottomLinks = links.filter(l => ['/', '/videos', '/content', '/settings'].includes(l.to));

  return (
    <div className="flex h-screen bg-dark-bg">
      {/* Sidebar — hidden on mobile (<768px) */}
      <aside className="hidden md:flex md:flex-col w-56 bg-dark-card border-r border-dark-border shrink-0" aria-label="主导航">
        <div className="p-4 border-b border-dark-border">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-accent-primary">🤖</span> Aiops
          </h1>
          <p className="text-xs text-gray-500 mt-1">AI 内容运营平台</p>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-accent-primary/20 text-accent-primary' : 'text-gray-400 hover:bg-dark-hover hover:text-white'
                }`
              }
            >
              <l.icon size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-border">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-7 h-7 rounded-full bg-accent-primary/30 flex items-center justify-center text-xs font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-gray-300 truncate">{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-dark-hover rounded-lg transition-colors" aria-label="退出登录">
            <LogOut size={15} aria-hidden="true" /> 退出
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0" role="main" aria-label="主内容">
        <div className="p-4 sm:p-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar — <768px */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-dark-card border-t border-dark-border safe-bottom" aria-label="底部导航">
        <div className="flex items-center justify-around h-14">
          {bottomLinks.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] px-3 rounded-lg transition-colors ${
                  isActive ? 'text-accent-primary' : 'text-gray-500'
                }`
              }
            >
              <l.icon size={20} />
              <span className="text-[10px] font-medium">{l.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
