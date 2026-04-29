import { cn } from '@/lib/utils';

const variants = {
  safe: { color: 'var(--ifrit-safe)', label: 'Safe' },
  warning: { color: 'var(--ifrit-warning)', label: 'Warning' },
  fire: { color: 'var(--ifrit-fire)', label: 'Critical' },
  info: { color: 'var(--ifrit-info)', label: 'Info' },
  online: { color: 'var(--ifrit-safe)', label: 'Online' },
  offline: { color: 'var(--ifrit-text-muted)', label: 'Offline' },
};

export default function StatusIndicator({ status, showLabel = false, size = 'md', className }) {
  const v = variants[status] || variants.info;
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <div className={cn('flex items-center gap-2', className)} role="status" aria-label={`Status: ${v.label}`}>
      <div
        className={cn(
          'rounded-full flex-shrink-0',
          sizeClasses[size],
          status === 'fire' && 'led-fire',
          status === 'safe' && 'led-safe',
          status === 'warning' && 'led-warning',
        )}
        style={{ backgroundColor: v.color }}
      />
      {showLabel && (
        <span
          className="text-xs font-medium"
          style={{ color: v.color }}
        >
          {v.label}
        </span>
      )}
    </div>
  );
}
