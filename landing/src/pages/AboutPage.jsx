import { useLanguage } from '@/hooks/useLanguage';
import PageHero from '@/components/ui/PageHero';
import SectionHeading from '@/components/ui/SectionHeading';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function AboutPage() {
  const { t } = useLanguage();
  const values = t('about.values.items');

  return (
    <>
      <PageHero
        title={t('about.heroTitle')}
        subtitle={t('about.heroSubtitle')}
      />

      {/* Mission */}
      <section className="section-light py-24 md:py-32">
        <div className="container-wide max-w-4xl">
          <SectionHeading
            label={t('about.mission.label')}
            title={t('about.mission.title')}
            description={t('about.mission.description')}
          />
        </div>
      </section>

      {/* Values */}
      <section className="section-dark py-24 md:py-32">
        <div className="container-wide">
          <SectionHeading
            label={t('about.values.label')}
            title={t('about.values.title')}
            align="center"
            dark
          />

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-display text-3xl font-bold text-ifrit-red/30">
                      0{i + 1}
                    </span>
                  </div>
                  <h4 className="font-display text-lg font-semibold text-text-on-dark">
                    {value.title}
                  </h4>
                  <p className="text-sm text-text-on-dark-muted leading-relaxed">
                    {value.description}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Team placeholder */}
      <section className="section-light py-24 md:py-32">
        <div className="container-wide text-center">
          <SectionHeading
            label="TEAM"
            title={t('about.values.label') === 'NILAI' ? 'Tim Kami' : 'Our Team'}
            description={
              t('about.values.label') === 'NILAI'
                ? 'Bersama membangun masa depan keamanan kebakaran.'
                : 'Together building the future of fire safety.'
            }
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {[1, 2, 3].map((i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 rounded-full bg-light-surface-2 border border-light-border flex items-center justify-center">
                    <span className="text-2xl text-text-on-light-muted">👤</span>
                  </div>
                  <div className="text-center">
                    <p className="font-display font-semibold text-sm">Team Member {i}</p>
                    <p className="text-xs text-text-on-light-muted">Role</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
