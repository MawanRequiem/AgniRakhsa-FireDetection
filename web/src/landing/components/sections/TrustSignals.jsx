import { useLanguage } from '@landing/hooks/useLanguage';
import ScrollReveal from '@landing/components/ui/ScrollReveal';
import { ShieldCheck, Zap, Clock, Eye } from 'lucide-react';

const METRICS = [
  { icon: Zap, key: 0 },
  { icon: ShieldCheck, key: 1 },
  { icon: Clock, key: 2 },
  { icon: Eye, key: 3 },
];

export default function TrustSignals() {
  const { t } = useLanguage();
  const stats = t('trust.stats');

  return (
    <section className="section-light py-24 md:py-32 border-t border-light-border/30" id="trust">
      <div className="container-wide">
        <ScrollReveal>
          <span className="font-display text-xs font-semibold tracking-[0.2em] uppercase text-ifrit-red mb-4 block">
            {t('trust.label')}
          </span>
        </ScrollReveal>
        <ScrollReveal delay={80}>
          <h2 className="mb-12">{t('trust.title')}</h2>
        </ScrollReveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-1 bg-light-border/20 rounded-2xl overflow-hidden">
          {stats.map((stat, i) => {
            const Icon = METRICS[i].icon;
            return (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="bg-light-bg p-8 flex flex-col gap-4 h-full hover:bg-light-surface hover:-translate-y-1 transition-all duration-300 cursor-default rounded-2xl">
                  <Icon size={20} className="text-ifrit-red/50" />
                  <div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="font-display text-4xl font-bold text-text-on-light tracking-tight">
                        {stat.value}
                      </span>
                      <span className="text-lg font-bold text-ifrit-red/60">{stat.suffix}</span>
                    </div>
                    <p className="text-sm text-text-on-light-muted leading-relaxed">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
