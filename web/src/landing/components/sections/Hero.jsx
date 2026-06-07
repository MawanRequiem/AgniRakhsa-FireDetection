import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLanguage } from '@landing/hooks/useLanguage';
import { useReducedMotion } from '@landing/hooks/useReducedMotion';
import EmberCanvas from '@landing/components/ui/EmberCanvas';
import Button from '@landing/components/ui/Button';

export default function Hero() {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.12,
        delayChildren: reducedMotion ? 0 : 0.2,
      },
    },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: reducedMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] },
    },
  };

  const scaleFade = {
    hidden: { opacity: 0, scale: reducedMotion ? 1 : 0.94 },
    show: {
      opacity: 1,
      scale: 1,
      transition: { duration: reducedMotion ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] },
    },
  };

  return (
    <section
      id="hero"
      className="relative section-dark min-h-screen flex items-center overflow-hidden"
    >
      {/* Ember particles */}
      <EmberCanvas />

      {/* Radial gradient - ember glow from bottom */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% 100%, oklch(0.30 0.15 25 / 0.3), transparent 70%),
            radial-gradient(ellipse 60% 40% at 20% 80%, oklch(0.35 0.12 35 / 0.1), transparent 60%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Subtle top vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, oklch(0.08 0.01 25 / 0.6) 0%, transparent 40%)',
        }}
        aria-hidden="true"
      />

      {/* Content — left-anchored briefing layout */}
      <motion.div
        className="container-wide relative z-10 pt-24 pb-32 md:py-0"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center min-h-screen">
          {/* Left: brand + message */}
          <div className="pt-0 lg:pt-0">
            {/* Brand wordmark */}
            <motion.h1
              variants={scaleFade}
              className="font-display font-black tracking-tight leading-none mb-6"
              style={{
                fontSize: 'var(--text-hero)',
                letterSpacing: '-0.04em',
              }}
            >
              <span className="text-text-on-dark">IF</span>
              <span className="text-ifrit-red">R</span>
              <span className="text-text-on-dark">IT</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              variants={fadeUp}
              className="font-display text-2xl md:text-3xl font-medium text-text-on-dark tracking-tight mb-4"
            >
              {t('hero.tagline')}
            </motion.p>

            {/* Subtitle */}
            <motion.p
              variants={fadeUp}
              className="text-lg text-text-on-dark-muted mb-10 leading-relaxed max-w-[36rem]"
            >
              {t('hero.subtitle')}
            </motion.p>

            {/* CTAs — full-width on mobile, side-by-side on sm+ */}
            <motion.div
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-stretch sm:items-start gap-4 mb-16"
            >
              <Button as={Link} to="/contact" size="lg" className="w-full sm:w-auto text-center">
                {t('hero.cta')}
              </Button>
              <Button
                as="a"
                href="#features"
                variant="ghost"
                size="lg"
                className="w-full sm:w-auto text-center text-text-on-dark/70 hover:text-text-on-dark border-text-on-dark/15 hover:border-text-on-dark/30"
              >
                {t('hero.ctaSecondary')}
              </Button>
            </motion.div>

            {/* System status proof element */}
            <motion.div
              variants={fadeUp}
              className="border-t border-white/5 pt-8"
            >
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-500 animate-ping opacity-30" style={{ animationDuration: '3s' }} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-wider">System Status</p>
                    <p className="text-sm font-mono font-bold text-green-400">OPERATIONAL</p>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/8" />
                <div>
                  <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Response Time</p>
                  <p className="text-sm font-mono font-bold text-white/60">&lt;1.2s</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right: CCTV preview — domain evidence in the first viewport */}
          <motion.div variants={fadeUp} className="hidden lg:block">
            <div className="relative rounded-2xl overflow-hidden bg-dark-surface/60 border border-white/5 aspect-[4/3]">
              <div className="absolute inset-0 bg-dark-bg/70" />
              {/* Corner brackets */}
              <div className="absolute inset-3 border border-ifrit-red/15 rounded-xl">
                <div className="absolute top-0 left-0 right-0 h-px bg-ifrit-red/30 animate-[scanline_4s_ease-in-out_infinite]" />
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-ifrit-red/40 rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-ifrit-red/40 rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-ifrit-red/40 rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-ifrit-red/40 rounded-br" />
              </div>
              {/* Center detection indicator */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full border-2 border-ifrit-red/30 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-ifrit-red animate-pulse" />
                </div>
              </div>
              {/* REC badge */}
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-bg/60 border border-white/5">
                <div className="w-2 h-2 rounded-full bg-ifrit-red animate-pulse" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Live</span>
              </div>
              {/* Zone labels */}
              <div className="absolute bottom-4 left-4">
                <p className="text-[10px] font-mono font-bold text-white/25 uppercase tracking-widest">Zone B3 · Aktif</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          variants={fadeUp}
          className="absolute bottom-10 left-1/2 -translate-x-1/2"
        >
          <div className="w-5 h-8 rounded-full border-2 border-text-on-dark/15 flex justify-center pt-1.5">
            <motion.div
              className="w-1 h-2 rounded-full bg-text-on-dark/30"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(calc(100% + 180px)); }
        }
      `}</style>
    </section>
  );
}
