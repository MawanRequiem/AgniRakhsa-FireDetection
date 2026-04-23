import { useLanguage } from '@/hooks/useLanguage';
import ScrollReveal from '@/components/ui/ScrollReveal';
import SectionHeading from '@/components/ui/SectionHeading';

export default function TechStack() {
  const { t } = useLanguage();

  return (
    <section className="section-dark py-24 md:py-32" id="techStack">
      <div className="container-wide">
        <SectionHeading
          label={t('techStack.label')}
          title={t('techStack.title')}
          description={t('techStack.description')}
          align="center"
          dark
        />
      </div>
    </section>
  );
}
