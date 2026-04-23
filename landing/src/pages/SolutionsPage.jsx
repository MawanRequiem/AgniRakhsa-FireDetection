import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import PageHero from '@/components/ui/PageHero';
import SectionHeading from '@/components/ui/SectionHeading';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';

const icons = {
  building: '🏢',
  warehouse: '🏭',
  hospital: '🏥',
  server: '🖥️',
};

export default function SolutionsPage() {
  const { t } = useLanguage();
  const useCases = t('solutions.useCases.items');

  return (
    <>
      <PageHero
        title={t('solutions.heroTitle')}
        subtitle={t('solutions.heroSubtitle')}
      />

      {/* Use Cases */}
      <section className="section-light py-24 md:py-32">
        <div className="container-wide">
          <SectionHeading
            label={t('solutions.useCases.label')}
            title={t('solutions.useCases.title')}
            align="center"
          />

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-8">
            {useCases.map((uc, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="
                  bg-light-surface rounded-[var(--radius-lg)]
                  p-8 h-full flex flex-col gap-4
                  border border-light-border/50
                  hover:border-ifrit-red/20
                  transition-colors duration-[var(--duration-normal)]
                ">
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{icons[uc.icon] || '🔥'}</span>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-xl font-display font-semibold">{uc.title}</h3>
                      <p className="text-text-on-light-muted text-sm leading-relaxed">
                        {uc.description}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-dark py-20 md:py-28">
        <div className="container-wide text-center">
          <ScrollReveal>
            <h2 className="text-text-on-dark mb-4">
              {t('ctaBanner.title')}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <p className="text-text-on-dark-muted text-lg max-w-xl mx-auto mb-8">
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
    </>
  );
}
