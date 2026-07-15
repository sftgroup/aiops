import { useTranslation } from 'react-i18next';
import { Sparkles, Github, Mail, ArrowUp } from 'lucide-react';

export default function Footer() {
  const { t } = useTranslation('landing');

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative border-t border-dark-border">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <span className="text-lg font-bold text-white">Aiops</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              {t('footer.description')}
            </p>
          </div>

          {/* Links */}
          <div className="md:col-span-1">
            <h4 className="text-sm font-semibold text-white mb-4">Links</h4>
            <ul className="space-y-3">
              <li>
                <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-sm text-gray-500 hover:text-accent-primary transition-colors">
                  {t('nav.features')}
                </button>
              </li>
              <li>
                <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-sm text-gray-500 hover:text-accent-primary transition-colors">
                  {t('nav.pricing')}
                </button>
              </li>
              <li>
                <button className="text-sm text-gray-500 hover:text-accent-primary transition-colors">
                  {t('footer.contact')}
                </button>
              </li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div className="md:col-span-1">
            <h4 className="text-sm font-semibold text-white mb-4">{t('footer.contact')}</h4>
            <ul className="space-y-3">
              <li>
                <a href="mailto:contact@aiops.com" className="flex items-center gap-2 text-sm text-gray-500 hover:text-accent-primary transition-colors">
                  <Mail size={14} />
                  contact@aiops.com
                </a>
              </li>
              <li>
                <a href="https://github.com/aiops" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-gray-500 hover:text-accent-primary transition-colors">
                  <Github size={14} />
                  {t('footer.github')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 pt-8 border-t border-dark-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">{t('footer.copyright')}</p>
          <button
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-white transition-colors"
          >
            <ArrowUp size={14} />
            Top
          </button>
        </div>
      </div>
    </footer>
  );
}
