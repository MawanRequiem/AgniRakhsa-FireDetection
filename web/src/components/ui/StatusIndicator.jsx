import { cn } from '@/lib/utils';

const variants = {
  safe: { color: 'var(--ifrit-safe)', label: 'Aman' },
  warning: { color: 'var(--ifrit-warning)', label: 'Peringatan' },
  fire: { color: 'var(--ifrit-fire)', label: 'Kritis' },
  info: { color: 'var(--ifrit-info)', label: 'Info' },
  calibrating: { color: 'var(--ifrit-info)', label: 'Kalibrasi' },
  warming_up: { color: '#f97316', label: 'Pemanasan' },
  burn_in: { color: '#eab308', label: 'Uji Coba (24j)' },
  online: { color: 'var(--ifrit-safe)', label: 'Aktif' },
  offline: { color: 'var(--ifrit-text-muted)', label: 'Mati' },
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
          status === 'calibrating' && 'led-calibrating',
          status === 'warming_up' && 'led-warming-up',
          status === 'burn_in' && 'led-burn-in',
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
