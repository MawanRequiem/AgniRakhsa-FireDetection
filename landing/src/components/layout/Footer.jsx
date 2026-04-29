import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';

export default function Footer() {
  const { t } = useLanguage();

  const productLinks = [
    { to: '/#features', label: t('features.label') },
    { to: '/#techStack', label: t('techStack.label') },
    { to: '/solutions', label: t('nav.solutions') },
  ];

  const companyLinks = [
    { to: '/about', label: t('nav.about') },
    { to: '/contact', label: t('nav.contact') },
  ];

  return (
    <footer className="section-dark border-t border-dark-border/30">
      <div className="container-wide py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
          {/* Brand column */}
          <div className="md:col-span-5">
            <Link to="/" className="font-display text-2xl font-bold text-text-on-dark tracking-tight">
              IFRIT<span className="text-ifrit-red">.</span>
            </Link>
            <p className="text-text-on-dark-muted" style={{ marginTop: '1rem', fontSize: '0.875rem', maxWidth: '24rem', lineHeight: 1.65 }}>
              {t('footer.description')}
            </p>
          </div>

          {/* Navigation columns */}
          <div className="md:col-span-3">
            <h4 className="font-display text-xs font-semibold tracking-[0.15em] uppercase text-text-on-dark-muted mb-4">
              {t('footer.links.product')}
            </h4>
            <ul className="flex flex-col gap-3">
              {productLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-text-on-dark-muted hover:text-text-on-dark transition-colors duration-[var(--duration-fast)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="font-display text-xs font-semibold tracking-[0.15em] uppercase text-text-on-dark-muted mb-4">
              {t('footer.links.company')}
            </h4>
            <ul className="flex flex-col gap-3">
              {companyLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-text-on-dark-muted hover:text-text-on-dark transition-colors duration-[var(--duration-fast)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-dark-border/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-on-dark-muted">
            {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-6 text-text-on-dark-muted">
            <span className="text-xs opacity-60">Powered by AI</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
