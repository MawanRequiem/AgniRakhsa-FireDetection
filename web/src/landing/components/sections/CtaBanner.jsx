import { Link } from 'react-router-dom';
import { useLanguage } from '@landing/hooks/useLanguage';
import ScrollReveal from '@landing/components/ui/ScrollReveal';
import Button from '@landing/components/ui/Button';

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

      <div className="container-wide relative z-10 py-24 md:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <ScrollReveal>
            <div>
              <h2 className="text-text-on-dark mb-4">{t('ctaBanner.title')}</h2>
              <p className="text-text-on-dark-muted text-lg leading-relaxed">
                {t('ctaBanner.subtitle')}
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={150}>
            <div className="flex justify-center lg:justify-end">
              <Button as={Link} to="/contact" size="lg" className="w-full sm:w-auto">
                {t('ctaBanner.cta')}
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
