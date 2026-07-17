import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface Plan {
  name: string;
  displayName: string;
  price: number;
  contentPerMonth: number;
  ttsPerMonth: number;
  videoPerMonth: number;
  tokensPerMonth: number;
}

export default function PricingSection() {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch(apiUrl('/api/plans'))
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setPlans(d.plans || d))
      .catch(() => {});
  }, []);

  const handleCTA = (tier: string) => {
    if (tier === 'enterprise') {
      window.location.href = 'mailto:contact@aiops.com';
    } else {
      navigate('/login');
    }
  };

  if (!plans.length) return null;

  return (
    <section id="pricing" className="relative py-24 sm:py-32">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-accent-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-1/3 left-0 w-[400px] h-[400px] bg-purple-600/5 blur-[100px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20 text-accent-primary text-xs font-medium mb-4">
            <Sparkles size={12} />
            Pricing
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">{t('pricing.title')}</h2>
          <p className="mt-4 text-lg text-gray-400">{t('pricing.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isHighlight = plan.name === 'starter';
            const isEnterprise = plan.name === 'enterprise';

            return (
              <div
                key={plan.name}
                className={`relative group rounded-2xl border transition-all duration-300 ${
                  isHighlight
                    ? 'bg-gradient-to-b from-dark-card via-dark-card to-dark-card/90 border-accent-primary/40 shadow-lg shadow-accent-primary/10 scale-[1.02] sm:scale-105'
                    : 'bg-dark-card/60 backdrop-blur-sm border-dark-border hover:border-accent-primary/30'
                } ${
                  !isHighlight ? 'hover:-translate-y-1' : ''
                }`}
              >
                {isHighlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-4 py-1 rounded-full bg-accent-primary text-white text-xs font-medium shadow-lg shadow-accent-primary/30">
                      <Sparkles size={12} />
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6 sm:p-8 flex flex-col h-full">
                  <div className="mb-6">
                    <h3 className={`text-xl font-bold ${isHighlight ? 'text-accent-primary' : 'text-white'}`}>
                      {plan.displayName || plan.name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-2">
                      {plan.name === 'free' ? 'Personal exploration' :
                       plan.name === 'starter' ? 'Professional creators' :
                       plan.name === 'pro' ? 'Small & mid teams' :
                       'Large enterprises'}
                    </p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl sm:text-4xl font-bold ${isHighlight ? 'text-accent-primary' : 'text-white'}`}>
                        {plan.price?.toLocaleString() || plan.price} USDC
                      </span>
                      {!isEnterprise && <span className="text-sm text-gray-500">/month</span>}
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    <li className="flex items-start gap-3">
                      <Check size={16} className="text-accent-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-400">{plan.contentPerMonth || 0} AI generations/month</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={16} className="text-accent-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-400">{plan.ttsPerMonth || 0} TTS/month</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={16} className="text-accent-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-400">{plan.videoPerMonth || 0} videos/month</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check size={16} className="text-accent-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-400">
                        {plan.tokensPerMonth ? `${+(plan.tokensPerMonth/1000).toFixed(0)}K tokens/month` : 'Standard support'}
                      </span>
                    </li>
                  </ul>

                  <button
                    onClick={() => handleCTA(plan.name)}
                    className={`w-full py-3 rounded-xl text-sm font-medium transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      isHighlight
                        ? 'bg-accent-primary hover:bg-accent-primary/80 text-white shadow-lg shadow-accent-primary/20'
                        : 'bg-dark-bg border border-dark-border text-gray-300 hover:border-accent-primary/50 hover:text-white'
                    }`}
                  >
                    {plan.name === 'free' ? 'Get Started' :
                     plan.name === 'enterprise' ? 'Contact Us' : 'Upgrade Now'}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
