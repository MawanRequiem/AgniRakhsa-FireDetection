import { useLanguage } from '@/hooks/useLanguage';
import ScrollReveal from '@/components/ui/ScrollReveal';
import SectionHeading from '@/components/ui/SectionHeading';

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
        {/* Heading: dark text color until transition */}
        <div className="pt-8">
          <SectionHeading
            label={t('problem.label')}
            title={t('problem.title')}
            description={t('problem.description')}
            align="center"
          />
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <ScrollReveal key={i} delay={i * 100}>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display text-ifrit-red" style={{ fontSize: 'var(--text-5xl)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
                  {stat.value}
                </div>
                <p className="text-text-on-light-muted" style={{ fontSize: '0.875rem', lineHeight: 1.65 }}>
                  {stat.label}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
