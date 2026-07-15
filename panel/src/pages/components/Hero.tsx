import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, Play } from 'lucide-react';

export default function Hero() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();

  const scrollToPricing = () => {
    const el = document.getElementById('pricing');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orb top-right */}
        <div className="absolute top-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-accent-primary/10 blur-[120px] animate-float" />
        {/* Gradient orb bottom-left */}
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full bg-purple-600/10 blur-[100px] animate-float" style={{ animationDelay: '2s' }} />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(99, 102, 241, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-medium mb-8 animate-fade-in">
          <Sparkles size={14} />
          AI-Powered Content Platform
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight animate-fade-in-up">
          <span className="text-white">{t('hero.title')}</span>
          <br />
          <span className="bg-gradient-to-r from-accent-primary via-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient-shift">
            {t('hero.subtitle')}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-1">
          {t('hero.tagline')}
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up-delay-2">
          <button
            onClick={() => navigate('/login')}
            className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-accent-primary hover:bg-accent-primary/80 text-white font-medium text-base transition-all active:scale-95 shadow-lg shadow-accent-primary/20 hover:shadow-accent-primary/30 animate-pulse-glow"
          >
            {t('hero.ctaTrial')}
            <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={scrollToPricing}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-dark-border hover:border-accent-primary/50 text-gray-300 hover:text-white font-medium text-base transition-all active:scale-95"
          >
            <Play size={16} />
            {t('hero.ctaPricing')}
          </button>
        </div>

        {/* Social proof */}
        <div className="mt-16 flex items-center justify-center gap-8 sm:gap-12 animate-fade-in-up-delay-3">
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-white">10K+</div>
            <div className="text-xs text-gray-500 mt-1">{t('stats.users')}</div>
          </div>
          <div className="w-px h-10 bg-dark-border" />
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-white">500+</div>
            <div className="text-xs text-gray-500 mt-1">{t('stats.teams')}</div>
          </div>
          <div className="w-px h-10 bg-dark-border" />
          <div className="text-center">
            <div className="text-2xl sm:text-3xl font-bold text-white">4.9</div>
            <div className="text-xs text-gray-500 mt-1">★ {t('stats.rating')}</div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
