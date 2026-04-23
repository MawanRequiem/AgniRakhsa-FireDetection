import { useLanguage } from '@/hooks/useLanguage';
import ScrollReveal from '@/components/ui/ScrollReveal';
import SectionHeading from '@/components/ui/SectionHeading';
import AnimatedCounter from '@/components/ui/AnimatedCounter';

export default function TrustSignals() {
  const { t } = useLanguage();
  const stats = t('trust.stats');

  return (
    <section className="section-light py-24 md:py-32" id="trust">
      <div className="container-wide">
        <SectionHeading
          label={t('trust.label')}
          title={t('trust.title')}
          align="center"
        />

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat, i) => (
            <ScrollReveal key={i} delay={i * 80}>
              <div style={{ textAlign: 'center' }}>
                <div className="font-display text-ifrit-red" style={{ fontSize: 'var(--text-5xl)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
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
