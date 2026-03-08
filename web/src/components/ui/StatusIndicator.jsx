import { cn } from '@/lib/utils';

const variants = {
  safe: { color: 'var(--agni-safe)', label: 'Aman' },
  warning: { color: 'var(--agni-warning)', label: 'Peringatan' },
  fire: { color: 'var(--agni-fire)', label: 'BAHAYA' },
  info: { color: 'var(--agni-info)', label: 'Info' },
  online: { color: 'var(--agni-safe)', label: 'Online' },
  offline: { color: 'var(--agni-text-muted)', label: 'Offline' },
};

export default function StatusIndicator({ status, showLabel = false, size = 'md', className }) {
  const v = variants[status] || variants.info;
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
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
