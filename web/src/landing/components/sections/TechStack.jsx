import { useLanguage } from '@landing/hooks/useLanguage';
import ScrollReveal from '@landing/components/ui/ScrollReveal';

export default function TechStack() {
  const { t } = useLanguage();
  const layers = t('techStack.layers');

  return (
    <section className="section-dark py-24 md:py-32" id="techStack">
      <div className="container-wide">
        {/* Left-anchored header */}
        <ScrollReveal>
          <span className="font-display text-xs font-semibold tracking-[0.2em] uppercase text-ifrit-red mb-4 block">
            {t('techStack.label')}
          </span>
        </ScrollReveal>
        <ScrollReveal delay={80}>
          <h2 className="text-text-on-dark mb-4">{t('techStack.title')}</h2>
        </ScrollReveal>
        <ScrollReveal delay={160}>
          <p className="text-text-on-dark-muted text-lg leading-relaxed max-w-[36rem] mb-16">
            {t('techStack.description')}
          </p>
        </ScrollReveal>

        {/* Architecture layers — horizontal flow */}
        <div className="grid md:grid-cols-3 gap-6">
          {layers.map((layer, i) => (
            <ScrollReveal key={i} delay={i * 120}>
              <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 h-full hover:border-ifrit-red/20 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-dark-border">
                  <span className="w-6 h-6 rounded-md bg-ifrit-red/20 flex items-center justify-center text-[10px] font-mono font-bold text-ifrit-red">
                    0{i + 1}
                  </span>
                  <h4 className="text-sm font-display font-bold text-white tracking-tight">
                    {layer.name}
                  </h4>
                </div>
                <div className="space-y-2">
                  {layer.items.map((item, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-white/5"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-ifrit-red/40" />
                      <span className="text-sm text-text-on-dark-muted font-body">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
