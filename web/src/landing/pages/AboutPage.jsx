import { useLanguage } from '@landing/hooks/useLanguage';
import PageHero from '@landing/components/ui/PageHero';
import SectionHeading from '@landing/components/ui/SectionHeading';
import ScrollReveal from '@landing/components/ui/ScrollReveal';

function getInitials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AboutPage() {
  const { t } = useLanguage();
  const values = t('about.values.items');
  const team = t('about.team');

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

      {/* Team */}
      <section className="section-light py-24 md:py-32">
        <div className="container-wide text-center">
          <SectionHeading
            label={team.label}
            title={team.title}
            description={team.subtitle}
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {team.members.map((member, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-light-border bg-light-surface p-6 hover:-translate-y-1 transition-all duration-300">
                  <div className="w-20 h-20 rounded-full bg-ifrit-red/10 border-2 border-ifrit-red/20 flex items-center justify-center">
                    <span className="font-display text-lg font-bold text-ifrit-red">
                      {getInitials(member.name)}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="font-display font-semibold text-sm text-text-on-light">
                      {member.name}
                    </p>
                    <p className="text-xs text-text-on-light-muted mt-1">{member.role}</p>
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
