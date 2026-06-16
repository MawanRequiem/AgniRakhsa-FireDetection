import SkeletonBase from './SkeletonBase';

/**
 * Text-line skeleton block.
 *
 * @param {object} props
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Line height
 * @param {'dark' | 'light'} [props.variant='dark'] - Surface palette
 * @param {string} [props.width] - Tailwind width class (e.g. "w-3/4") or inline style
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.delay=0] - Animation delay in seconds
 */
export default function SkeletonText({
  size = 'md',
  variant = 'dark',
  width,
  className = '',
  delay = 0,
  ...props
}) {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-5',
  };

  // Support both Tailwind width class and inline style values.
  const widthStyle =
    typeof width === 'string' && width.includes('w-')
      ? undefined
      : width
        ? { width }
        : undefined;

  const widthClass =
    typeof width === 'string' && width.includes('w-') ? width : 'w-full';

  return (
    <SkeletonBase
      variant={variant}
      className={`rounded-full ${sizeClasses[size]} ${widthClass} ${className}`}
      style={widthStyle}
      delay={delay}
      {...props}
    />
  );
}
