import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useScrollPosition } from '@/hooks/useScrollPosition';
import LanguageToggle from '@/components/ui/LanguageToggle';
import Button from '@/components/ui/Button';

export default function Header() {
  const { t } = useLanguage();
  const location = useLocation();
  const scrollY = useScrollPosition();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isHome = location.pathname === '/';
  const isScrolled = scrollY > 60;
  const showSolid = !isHome || isScrolled;

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/about', label: t('nav.about') },
    { to: '/solutions', label: t('nav.solutions') },
    { to: '/contact', label: t('nav.contact') },
  ];

  return (
    <header
      className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-quart)]
        ${showSolid
          ? 'bg-dark-bg/95 backdrop-blur-md border-b border-dark-border/50'
          : 'bg-transparent'
        }
      `.replace(/\s+/g, ' ').trim()}
    >
      <nav className="container-wide flex items-center justify-between h-16 md:h-20">
        {/* Wordmark */}
        <Link
          to="/"
          className="font-display text-xl md:text-2xl font-bold tracking-tight text-text-on-dark"
        >
          IFRIT
          <span className="text-ifrit-red">.</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`
                font-body text-sm font-medium tracking-wide
                transition-colors duration-[var(--duration-fast)]
                hover:text-ifrit-red
                ${location.pathname === link.to
                  ? 'text-ifrit-red'
                  : 'text-text-on-dark-muted'
                }
              `.replace(/\s+/g, ' ').trim()}
            >
              {link.label}
            </Link>
          ))}

          <LanguageToggle className="text-text-on-dark-muted" />

          <Button
            as={Link}
            to="/contact"
            size="sm"
          >
            {t('nav.requestDemo')}
          </Button>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden flex flex-col gap-1.5 p-2 text-text-on-dark"
          aria-label="Toggle navigation menu"
          aria-expanded={mobileOpen}
        >
          <span className={`block w-6 h-0.5 bg-current transition-transform duration-200 ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-current transition-opacity duration-200 ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-current transition-transform duration-200 ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`
          md:hidden overflow-hidden
          transition-all duration-[var(--duration-normal)] ease-[var(--ease-out-quart)]
          bg-dark-bg/98 backdrop-blur-lg border-t border-dark-border/30
          ${mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
        `.replace(/\s+/g, ' ').trim()}
      >
        <div className="container-wide py-6 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`
                font-body text-base font-medium py-2
                ${location.pathname === link.to ? 'text-ifrit-red' : 'text-text-on-dark-muted'}
              `.replace(/\s+/g, ' ').trim()}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-4 pt-2 border-t border-dark-border/30">
            <LanguageToggle className="text-text-on-dark-muted" />
            <Button as={Link} to="/contact" size="sm" className="flex-1 justify-center">
              {t('nav.requestDemo')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
