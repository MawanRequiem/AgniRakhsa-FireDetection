import { cn } from '@/lib/utils';

export default function StatCard({ icon: Icon, label, value, unit, trend, className }) {
  return (
    <div
      className={cn(
        'rounded-md p-4 border transition-colors',
        className,
      )}
      style={{
        backgroundColor: 'var(--agni-bg-tertiary)',
        borderColor: 'var(--agni-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>
          {label}
        </span>
        {Icon && (
          <div className="p-1.5 rounded" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <Icon className="w-4 h-4" style={{ color: 'var(--agni-amber)' }} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono" style={{ color: 'var(--agni-text-primary)' }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs" style={{ color: 'var(--agni-text-muted)' }}>
            {unit}
          </span>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-2 text-xs" style={{ color: trend >= 0 ? 'var(--agni-safe)' : 'var(--agni-fire)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last hour
        </div>
      )}
    </div>
  );
}
