import { motion } from 'framer-motion';

/**
 * Base animated skeleton block using Framer Motion.
 * Pulses opacity to convey a "loading" state without being noisy.
 *
 * @param {object} props
 * @param {string} [props.className] - Additional CSS classes (e.g. layout/sizing)
 * @param {React.ReactNode} [props.children] - Optional content inside the skeleton
 * @param {'dark' | 'light'} [props.variant='dark'] - Surface palette:
 *   `dark` blends with `section-dark` (deep neutrals),
 *   `light` blends with `section-light` (warm neutrals).
 * @param {number} [props.delay=0] - Animation delay in seconds
 * @param {number} [props.duration=1.5] - Pulse cycle duration in seconds
 */
export default function SkeletonBase({
  className = '',
  children,
  variant = 'dark',
  delay = 0,
  duration = 1.5,
  ...props
}) {
  const variantClasses =
    variant === 'light'
      ? 'bg-[var(--color-light-surface-2)]'
      : 'bg-[var(--color-dark-surface-2)]';

  return (
    <motion.div
      className={`${variantClasses} ${className}`}
      animate={{ opacity: [0.45, 1, 0.45] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
      aria-hidden="true"
      {...props}
    >
      {children}
    </motion.div>
  );
}
