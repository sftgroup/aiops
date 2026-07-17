import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Sparkles } from 'lucide-react';

export default function Navbar() {
  const { t, i18n } = useTranslation('landing');
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleLang = () => {
    const next = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN';
    i18n.changeLanguage(next);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-dark-bg/90 backdrop-blur-xl border-b border-dark-border/50 shadow-lg shadow-black/10' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">Aiops</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo('features')} className="text-sm text-gray-400 hover:text-white transition-colors">
              {t('nav.features')}
            </button>
            <button onClick={() => scrollTo('pricing')} className="text-sm text-gray-400 hover:text-white transition-colors">
              {t('nav.pricing')}
            </button>

            {/* Language toggle */}
            <button
              onClick={toggleLang}
              className="text-xs px-2.5 py-1 rounded-full border border-dark-border text-gray-500 hover:text-white hover:border-gray-500 transition-all"
            >
              {i18n.language === 'zh-CN' ? 'EN' : '中文'}
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="text-sm px-5 py-2 rounded-xl bg-accent-primary hover:bg-accent-primary/80 text-white font-medium transition-all active:scale-95"
              >
                {t('nav.login')}
              </button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-dark-card/95 backdrop-blur-xl border-t border-dark-border animate-fade-in">
          <div className="px-4 py-4 space-y-3">
            <button onClick={() => scrollTo('features')} className="block w-full text-left text-sm text-gray-400 hover:text-white py-2 transition-colors">
              {t('nav.features')}
            </button>
            <button onClick={() => scrollTo('pricing')} className="block w-full text-left text-sm text-gray-400 hover:text-white py-2 transition-colors">
              {t('nav.pricing')}
            </button>
            <div className="h-px bg-dark-border" />
            <button
              onClick={() => navigate('/login')}
              className="w-full py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary/80 text-white text-sm font-medium transition-all text-center"
            >
              {t('nav.login')}
            </button>
            <button onClick={toggleLang} className="text-xs px-3 py-1.5 rounded-full border border-dark-border text-gray-500 hover:text-white">
              {i18n.language === 'zh-CN' ? 'English' : '中文'}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
