import { cn } from '@/lib/utils';

export default function StatCard({ icon: Icon, label, value, unit, trend, className }) {
  return (
    <div
      className={cn(
        'rounded-lg p-4 border transition-colors',
        className,
      )}
      style={{
        backgroundColor: 'var(--ifrit-bg-tertiary)',
        borderColor: 'var(--ifrit-border)',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
          {label}
        </span>
        {Icon && (
          <div className="p-1.5 rounded-md" style={{ backgroundColor: 'var(--ifrit-brand-subtle)' }}>
            <Icon className="w-4 h-4" style={{ color: 'var(--ifrit-brand)' }} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold font-mono" style={{ color: 'var(--ifrit-text-primary)' }}>
          {value}
        </span>
        {unit && (
          <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
            {unit}
          </span>
        )}
      </div>
      {trend !== undefined && (
        <div className="mt-2 text-xs" style={{ color: trend >= 0 ? 'var(--ifrit-safe)' : 'var(--ifrit-fire)' }}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last hour
        </div>
      )}
    </div>
  );
}
