import { useLanguage } from '@landing/hooks/useLanguage';
import ScrollReveal from '@landing/components/ui/ScrollReveal';

const TREND_ARROWS = ['Meningkat', 'Kritis', 'Tertinggal'];

export default function Problem() {
  const { t } = useLanguage();
  const stats = t('problem.stats');

  return (
    <section className="relative overflow-hidden" id="problem">
      {/* Transition gradient: dark → light */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(
              to bottom,
              var(--color-dark-bg) 0%,
              oklch(0.14 0.012 25) 15%,
              var(--color-light-bg) 45%,
              var(--color-light-bg) 100%
            )
          `,
        }}
        aria-hidden="true"
      />

      <div className="container-wide relative z-10 py-24 md:py-32">
        {/* Left-anchored briefing header */}
        <div className="grid lg:grid-cols-2 gap-16 items-end">
          <div>
            <ScrollReveal>
              <span className="font-display text-xs font-semibold tracking-[0.2em] uppercase text-ifrit-red mb-4 block">
                {t('problem.label')}
              </span>
            </ScrollReveal>
            <ScrollReveal delay={80}>
              <h2 className="mb-4">{t('problem.title')}</h2>
            </ScrollReveal>
            <ScrollReveal delay={160}>
              <p className="text-text-on-light-muted text-lg leading-relaxed max-w-[32rem]">
                {t('problem.description')}
              </p>
            </ScrollReveal>
          </div>

          {/* Stats — horizontal bars with trend context */}
          <div className="flex flex-col gap-6">
            {stats.map((stat, i) => (
              <ScrollReveal key={i} delay={i * 100}>
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="font-display text-2xl font-bold text-text-on-light tracking-tight">
                      {stat.value}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ifrit-red/70">
                      {['↑ 12% YoY', '↓ Kritis', '↑ Tertinggal'][i] || ''}
                    </span>
                  </div>
                  <div className="h-1 bg-light-border rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-ifrit-red/30 rounded-full transition-all duration-700"
                      style={{ width: `${[40, 25, 82][i]}%` }}
                    />
                  </div>
                  <p className="text-sm text-text-on-light-muted leading-relaxed">
                    {stat.label}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
