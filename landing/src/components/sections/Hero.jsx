import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/hooks/useLanguage';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import EmberCanvas from '@/components/ui/EmberCanvas';
import Button from '@/components/ui/Button';

export default function Hero() {
  const { t } = useLanguage();
  const reducedMotion = useReducedMotion();

  const container = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.15,
        delayChildren: reducedMotion ? 0 : 0.3,
      },
    },
  };

  const fadeUp = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 30 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reducedMotion ? 0 : 0.8,
        ease: [0.16, 1, 0.3, 1], // ease-out-expo
      },
    },
  };

  const scaleFade = {
    hidden: { opacity: 0, scale: reducedMotion ? 1 : 0.92 },
    show: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: reducedMotion ? 0 : 1,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section
      id="hero"
      className="relative section-dark min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Ember particles */}
      <EmberCanvas />

      {/* Radial gradient — ember glow from bottom */}
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

      {/* Content */}
      <motion.div
        className="container-wide relative z-10 text-center py-32 md:py-40"
        variants={container}
        initial="hidden"
        animate="show"
      >
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
          className="text-lg text-text-on-dark-muted mx-auto mb-10 leading-relaxed w-full"
          style={{ maxWidth: '42rem' }}
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTAs */}
        <motion.div
          variants={fadeUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button as={Link} to="/contact" size="lg">
            {t('hero.cta')}
          </Button>
          <Button
            as="a"
            href="#features"
            variant="secondary"
            size="lg"
            className="text-text-on-dark border-text-on-dark/20 hover:border-text-on-dark/40"
          >
            {t('hero.ctaSecondary')}
          </Button>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          variants={fadeUp}
          className="mt-20 flex justify-center"
        >
          <div className="w-5 h-8 rounded-full border-2 border-text-on-dark/20 flex justify-center pt-1.5">
            <motion.div
              className="w-1 h-2 rounded-full bg-text-on-dark/40"
              animate={{ y: [0, 8, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
