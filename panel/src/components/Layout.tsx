import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, Video, FileText, Users, Settings, LogOut, Mic, Globe, User, Wallet, Bot, Store } from 'lucide-react';
import { SUPPORTED_LANGS } from '../i18n';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('common');
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const toggleLanguage = () => {
    const current = i18n.language;
    const next = SUPPORTED_LANGS.find(l => l.code !== current)?.code || 'en-US';
    i18n.changeLanguage(next);
  };

  const currentLang = SUPPORTED_LANGS.find(l => l.code === i18n.language) || SUPPORTED_LANGS[0];

  const isWalletUser = !!user?.walletAddress;

  const links = [
    { to: '/dashboard', icon: LayoutDashboard, key: 'nav.overview' as const },
    { to: '/team', icon: Users, key: 'nav.team' as const },
    { to: '/videos', icon: Video, key: 'nav.video' as const },
    { to: '/content', icon: FileText, key: 'nav.content' as const },
    { to: '/voice', icon: Mic, key: 'nav.voice' as const },
    { to: '/agents', icon: Bot, key: 'Agents' as const },
    { to: '/marketplace', icon: Store, key: 'Marketplace' as const },
    { to: '/accounts', icon: Users, key: 'nav.accounts' as const },
    { to: '/settings', icon: Settings, key: 'nav.settings' as const },
  ];

  const bottomLinks = links.filter(l => ['/dashboard', '/videos', '/content', '/voice', '/settings'].includes(l.to));

  // ── Wallet address short form ──
  const shortAddr = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : null;

  return (
    <div className="flex h-screen bg-dark-bg">
      {/* Sidebar — hidden on mobile (<768px) */}
      <aside className="hidden md:flex md:flex-col w-56 bg-dark-card border-r border-dark-border shrink-0" aria-label={t('app.subtitle')}>
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center gap-2 mb-1">
            <img src="/api/file/logo_platform.svg" alt="Aiops Logo" className="w-8 h-8 rounded-lg object-cover" />
            <h1 className="text-xl font-bold">{t('app.title')}</h1>
          </div>
          <p className="text-xs text-gray-500">{t('app.subtitle')}</p>
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
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-dark-border">
          {/* Language Switcher */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 w-full px-3 py-2 mb-2 text-sm text-gray-400 hover:text-white hover:bg-dark-hover rounded-lg transition-colors"
            title={t('language.switch')}
          >
            <Globe size={15} />
            <span>{currentLang.label}</span>
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-dark-hover rounded-lg transition-colors" aria-label={t('button.logout')}>
            <LogOut size={15} aria-hidden="true" /> {t('button.logout')}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Header Bar ── */}
        <header className="h-14 border-b border-dark-border bg-dark-card flex items-center justify-between px-4 sm:px-6 shrink-0">
          {/* Left: breadcrumb / page title hint */}
          <div className="md:hidden flex items-center">
            <img src="/api/file/logo_platform.svg" alt="Aiops" className="w-6 h-6 rounded" />
            <span className="ml-2 text-sm font-semibold text-white">{t('app.title')}</span>
          </div>
          <div className="hidden md:block" />

          {/* Right: user status */}
          <div className="flex items-center gap-3">
            {/* Language toggle (header) */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-dark-hover"
              title={t('language.switch')}
            >
              <Globe size={14} />
              <span className="hidden sm:inline">{currentLang.label}</span>
            </button>

            {/* User pill */}
            <NavLink
              to="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-hover hover:bg-[#2a2a3e] transition-colors border border-dark-border cursor-pointer"
              title={isWalletUser ? t('button.userCenter') : t('button.userCenter')}
            >
              {isWalletUser ? (
                <>
                  <Wallet size={14} className="text-[#6366f1]" />
                  <span className="text-xs text-gray-300 font-mono">{shortAddr}</span>
                </>
              ) : (
                <>
                  <div className="w-5 h-5 rounded-full bg-accent-primary/30 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {user?.username?.[0]?.toUpperCase() || <User size={10} />}
                  </div>
                  <span className="text-xs text-gray-300 truncate max-w-[120px]">{user?.username || user?.name}</span>
                </>
              )}
            </NavLink>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0" role="main" aria-label={t('app.subtitle')}>
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar — <768px */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-dark-card border-t border-dark-border safe-bottom" aria-label={t('app.subtitle')}>
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
              <span className="text-[10px] font-medium">{t(l.key)}</span>
            </NavLink>
          ))}
          {/* Mobile language toggle */}
          <button
            onClick={toggleLanguage}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[48px] min-h-[44px] px-3 rounded-lg text-gray-500 hover:text-white transition-colors"
          >
            <Globe size={20} />
            <span className="text-[10px] font-medium">{currentLang.label}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
