import SkeletonBase from './SkeletonBase';
import SkeletonText from './SkeletonText';

/**
 * Card-shaped skeleton block, themed for the landing page.
 * Optionally renders a header, multiple body lines, and a footer line.
 *
 * @param {object} props
 * @param {number} [props.lines=2] - Number of body text lines
 * @param {boolean} [props.hasHeader=false] - Show header text skeleton
 * @param {boolean} [props.hasFooter=false] - Show footer text skeleton
 * @param {'dark' | 'light'} [props.variant='dark'] - Surface palette
 * @param {string} [props.className] - Additional CSS classes for container
 * @param {number} [props.delay=0] - Base animation delay in seconds
 * @param {number} [props.staggerDelay=0.12] - Delay increment per line in seconds
 */
export default function SkeletonCard({
  lines = 2,
  hasHeader = false,
  hasFooter = false,
  variant = 'dark',
  className = '',
  delay = 0,
  staggerDelay = 0.12,
  ...props
}) {
  const bodyDelays = Array.from(
    { length: lines },
    (_, i) => delay + staggerDelay * (i + 1)
  );

  const surfaceClass =
    variant === 'light'
      ? 'bg-[var(--color-light-surface)] border-[var(--color-light-border)]'
      : 'bg-[var(--color-dark-surface)] border-[var(--color-dark-border)]';

  return (
    <div
      className={`rounded-[var(--radius-lg)] border overflow-hidden ${surfaceClass} ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="px-6 pt-6 pb-4">
          <SkeletonText variant={variant} size="lg" delay={delay} width="w-1/2" />
        </div>
      )}

      <div
        className={`px-6 ${hasHeader ? 'pb-3' : 'py-6'} ${hasFooter ? '' : 'pb-6'}`}
      >
        {bodyDelays.map((lineDelay, index) => (
          <div key={index} className={index > 0 ? 'mt-3' : ''}>
            <SkeletonText
              variant={variant}
              size="md"
              delay={lineDelay}
              width={index === lines - 1 ? 'w-3/4' : 'w-full'}
            />
          </div>
        ))}
      </div>

      {hasFooter && (
        <div
          className={`px-6 py-4 border-t ${
            variant === 'light'
              ? 'border-[var(--color-light-border)]'
              : 'border-[var(--color-dark-border)]'
          }`}
        >
          <SkeletonText
            variant={variant}
            size="sm"
            delay={delay + staggerDelay * (lines + 1)}
            width="w-1/3"
          />
        </div>
      )}
    </div>
  );
}
