import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Building2, FileText, Star } from 'lucide-react';

const statItems = [
  { key: 'users', icon: Users, value: 10000, suffix: '+', color: 'from-blue-500 to-cyan-400' },
  { key: 'teams', icon: Building2, value: 500, suffix: '+', color: 'from-green-500 to-emerald-400' },
  { key: 'daily', icon: FileText, value: 50000, suffix: '+', color: 'from-purple-500 to-pink-400' },
  { key: 'rating', icon: Star, value: 49, suffix: '', decimal: true, color: 'from-amber-500 to-orange-400' }, // 49 → 4.9
];

function AnimatedNumber({ target, duration = 2000, decimal = false }: { target: number; duration?: number; decimal?: boolean }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const startTime = Date.now();
          const tick = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setCurrent(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
            else setCurrent(target);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{decimal ? (current / 10).toFixed(1) : current.toLocaleString()}</span>;
}

export default function Stats() {
  const { t } = useTranslation('landing');

  return (
    <section className="relative py-20 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative bg-gradient-to-br from-dark-card via-dark-card to-dark-card/90 rounded-3xl border border-dark-border overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-accent-primary/5 blur-[80px] rounded-full" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-purple-600/5 blur-[80px] rounded-full" />
          </div>

          <div className="relative z-10 px-6 sm:px-10 lg:px-16 py-12 sm:py-16">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
              {statItems.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.key} className="text-center group">
                    <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} shadow-lg mb-4 transition-transform group-hover:scale-110`}>
                      <Icon size={22} className="text-white" />
                    </div>
                    <div className="text-2xl sm:text-4xl font-bold text-white tabular-nums">
                      {stat.decimal ? (
                        <AnimatedNumber target={stat.value} decimal />
                      ) : (
                        <AnimatedNumber target={stat.value} />
                      )}
                      {stat.suffix}
                      {!stat.decimal && !stat.suffix && '+'}
                    </div>
                    <div className="text-sm text-gray-500 mt-2">{t(`stats.${stat.key}`)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
