import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';

export default function CtaBanner() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      {/* Dark accent background with ember glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% 100%, oklch(0.35 0.18 25 / 0.25), transparent 70%),
            var(--color-dark-bg)
          `,
        }}
        aria-hidden="true"
      />

      <div className="container-wide relative z-10 py-20 md:py-28" style={{ textAlign: 'center' }}>
        <ScrollReveal>
          <h2 className="text-text-on-dark mb-4">{t('ctaBanner.title')}</h2>
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <p className="text-text-on-dark-muted text-lg mb-8" style={{ maxWidth: '36rem', marginInline: 'auto' }}>
            {t('ctaBanner.subtitle')}
          </p>
        </ScrollReveal>
        <ScrollReveal delay={200}>
          <Button as={Link} to="/contact" size="lg">
            {t('ctaBanner.cta')}
          </Button>
        </ScrollReveal>
      </div>
    </section>
  );
}
