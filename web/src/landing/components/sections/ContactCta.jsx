import { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@landing/hooks/useLanguage';
import ScrollReveal from '@landing/components/ui/ScrollReveal';
import SectionHeading from '@landing/components/ui/SectionHeading';
import Button from '@landing/components/ui/Button';

export default function ContactCta() {
  const { t } = useLanguage();
  const form = t('contactCta.form');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setTimeout(() => { setSending(false); setSubmitted(true); }, 800);
  }

  return (
    <section className="section-light py-24 md:py-32 border-t border-light-border/50" id="contact-cta">
      <div className="container-wide">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Text side */}
          <div>
            <SectionHeading
              title={t('contactCta.title')}
              description={t('contactCta.subtitle')}
            />
          </div>

          {/* Form side */}
          <ScrollReveal delay={100}>
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-light-surface rounded-[var(--radius-lg)] p-8 text-center"
              >
                <div className="text-4xl mb-4">✓</div>
                <h4 className="text-xl mb-2">
                  {t('contactCta.form.interest') === "I'm interested in" ? 'Thank you!' : 'Terima kasih!'}
                </h4>
                <p className="text-text-on-light-muted">
                  {t('contactCta.form.interest') === "I'm interested in"
                    ? "We'll be in touch soon."
                    : 'Kami akan segera menghubungi Anda.'
                  }
                </p>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-light-surface rounded-[var(--radius-lg)] p-6 md:p-8 flex flex-col gap-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="contact-name" className="text-sm font-medium text-text-on-light-muted">
                      {form.name}
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      className="
                        px-4 py-3 rounded-[var(--radius-md)]
                        bg-light-bg border border-light-border
                        text-text-on-light font-body text-sm
                        focus:outline-none focus:ring-2 focus:ring-ifrit-red/50 focus:border-ifrit-red
                        transition-all duration-[var(--duration-fast)]
                      "
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="contact-email" className="text-sm font-medium text-text-on-light-muted">
                      {form.email}
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      className="
                        px-4 py-3 rounded-[var(--radius-md)]
                        bg-light-bg border border-light-border
                        text-text-on-light font-body text-sm
                        focus:outline-none focus:ring-2 focus:ring-ifrit-red/50 focus:border-ifrit-red
                        transition-all duration-[var(--duration-fast)]
                      "
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-company" className="text-sm font-medium text-text-on-light-muted">
                    {form.company}
                  </label>
                  <input
                    id="contact-company"
                    type="text"
                    className="
                      px-4 py-3 rounded-[var(--radius-md)]
                      bg-light-bg border border-light-border
                      text-text-on-light font-body text-sm
                      focus:outline-none focus:ring-2 focus:ring-ifrit-red/50 focus:border-ifrit-red
                      transition-all duration-[var(--duration-fast)]
                    "
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-interest" className="text-sm font-medium text-text-on-light-muted">
                    {form.interest}
                  </label>
                  <select
                    id="contact-interest"
                    className="
                      px-4 py-3 rounded-[var(--radius-md)]
                      bg-light-bg border border-light-border
                      text-text-on-light font-body text-sm
                      focus:outline-none focus:ring-2 focus:ring-ifrit-red/50 focus:border-ifrit-red
                      transition-all duration-[var(--duration-fast)]
                      cursor-pointer
                    "
                  >
                    {form.options.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-message" className="text-sm font-medium text-text-on-light-muted">
                    {form.message}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    className="
                      px-4 py-3 rounded-[var(--radius-md)]
                      bg-light-bg border border-light-border
                      text-text-on-light font-body text-sm resize-none
                      focus:outline-none focus:ring-2 focus:ring-ifrit-red/50 focus:border-ifrit-red
                      transition-all duration-[var(--duration-fast)]
                    "
                  />
                </div>

                <Button type="submit" size="lg" className="mt-2 w-full justify-center" disabled={sending}>
                  {sending ? form.sending : form.submit}
                </Button>
              </form>
            )}
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
