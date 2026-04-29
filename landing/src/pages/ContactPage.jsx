import { useState } from 'react';
import { useLanguage } from '@/hooks/useLanguage';
import PageHero from '@/components/ui/PageHero';
import ScrollReveal from '@/components/ui/ScrollReveal';
import Button from '@/components/ui/Button';

export default function ContactPage() {
  const { t } = useLanguage();
  const form = t('contactCta.form');
  const info = t('contact.info');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <PageHero
        title={t('contact.heroTitle')}
        subtitle={t('contact.heroSubtitle')}
      />

      <section className="section-light py-24 md:py-32">
        <div className="container-wide">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16">
            {/* Contact info */}
            <div className="lg:col-span-2">
              <ScrollReveal>
                <div className="flex flex-col gap-8">
                  <div>
                    <h4 className="font-display text-xs font-semibold tracking-[0.15em] uppercase text-text-on-light-muted mb-2">
                      Email
                    </h4>
                    <a
                      href={`mailto:${info.email}`}
                      className="text-lg font-body font-medium text-ifrit-red hover:underline"
                    >
                      {info.email}
                    </a>
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-semibold tracking-[0.15em] uppercase text-text-on-light-muted mb-2">
                      Phone
                    </h4>
                    <a
                      href={`tel:${info.phone}`}
                      className="text-lg font-body font-medium hover:text-ifrit-red transition-colors"
                    >
                      {info.phone}
                    </a>
                  </div>
                  <div>
                    <h4 className="font-display text-xs font-semibold tracking-[0.15em] uppercase text-text-on-light-muted mb-2">
                      Location
                    </h4>
                    <p className="text-lg font-body font-medium">
                      {info.location}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>

            {/* Contact form */}
            <div className="lg:col-span-3">
              <ScrollReveal delay={100}>
                {submitted ? (
                  <div className="bg-light-surface rounded-[var(--radius-lg)] p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-3xl mx-auto mb-4">
                      ✓
                    </div>
                    <h3 className="text-2xl mb-2">
                      {form.interest === "I'm interested in" ? 'Message Sent!' : 'Pesan Terkirim!'}
                    </h3>
                    <p className="text-text-on-light-muted">
                      {form.interest === "I'm interested in"
                        ? "We'll get back to you within 24 hours."
                        : 'Kami akan menghubungi Anda dalam 24 jam.'
                      }
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="bg-light-surface rounded-[var(--radius-lg)] p-8 flex flex-col gap-5"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="c-name" className="text-sm font-medium text-text-on-light-muted">
                          {form.name}
                        </label>
                        <input
                          id="c-name"
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
                        <label htmlFor="c-email" className="text-sm font-medium text-text-on-light-muted">
                          {form.email}
                        </label>
                        <input
                          id="c-email"
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
                      <label htmlFor="c-company" className="text-sm font-medium text-text-on-light-muted">
                        {form.company}
                      </label>
                      <input
                        id="c-company"
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
                      <label htmlFor="c-interest" className="text-sm font-medium text-text-on-light-muted">
                        {form.interest}
                      </label>
                      <select
                        id="c-interest"
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
                          <option key={i}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="c-message" className="text-sm font-medium text-text-on-light-muted">
                        {form.message}
                      </label>
                      <textarea
                        id="c-message"
                        rows={5}
                        className="
                          px-4 py-3 rounded-[var(--radius-md)]
                          bg-light-bg border border-light-border
                          text-text-on-light font-body text-sm resize-none
                          focus:outline-none focus:ring-2 focus:ring-ifrit-red/50 focus:border-ifrit-red
                          transition-all duration-[var(--duration-fast)]
                        "
                      />
                    </div>

                    <Button type="submit" size="lg" className="mt-2 w-full justify-center">
                      {form.submit}
                    </Button>
                  </form>
                )}
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
