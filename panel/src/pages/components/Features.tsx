import { useTranslation } from 'react-i18next';
import { Zap, Mic, Film, Palette, Sparkles } from 'lucide-react';

const features = [
  {
    key: 'copywriting',
    icon: Zap,
    color: 'from-blue-500 to-cyan-400',
    glow: 'shadow-blue-500/10 group-hover:shadow-blue-500/30',
  },
  {
    key: 'tts',
    icon: Mic,
    color: 'from-green-500 to-emerald-400',
    glow: 'shadow-green-500/10 group-hover:shadow-green-500/30',
  },
  {
    key: 'video',
    icon: Film,
    color: 'from-purple-500 to-pink-400',
    glow: 'shadow-purple-500/10 group-hover:shadow-purple-500/30',
  },
  {
    key: 'poster',
    icon: Palette,
    color: 'from-amber-500 to-orange-400',
    glow: 'shadow-amber-500/10 group-hover:shadow-amber-500/30',
  },
];

export default function Features() {
  const { t } = useTranslation('landing');

  return (
    <section id="features" className="relative py-24 sm:py-32">
      {/* Background subtle glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-accent-primary/5 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-medium mb-4">
            <Sparkles size={12} />
            Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">{t('features.title')}</h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">{t('features.subtitle')}</p>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.key}
                className="group relative bg-dark-card/60 backdrop-blur-sm border border-dark-border hover:border-accent-primary/30 rounded-2xl p-6 sm:p-8 transition-all duration-300 hover:-translate-y-2 shadow-lg hover:shadow-2xl hover:shadow-accent-primary/10"
              >
                {/* Gradient hover overlay */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-accent-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                {/* Icon */}
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.color} shadow-lg mb-5 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                  <Icon size={24} className="text-white" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-white mb-3">
                  {t(`features.${feature.key}.title`)}
                </h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {t(`features.${feature.key}.desc`)}
                </p>

                {/* Decorative corner */}
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute -top-4 -right-4 w-8 h-8 bg-accent-primary/20 rounded-full blur-md" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
