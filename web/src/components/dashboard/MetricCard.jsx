import { cn } from '@/lib/utils';

const colorMap = {
  blue: { icon: 'var(--ifrit-info)', bg: 'rgba(59, 130, 246, 0.08)' },
  green: { icon: 'var(--ifrit-safe)', bg: 'rgba(16, 185, 129, 0.08)' },
  red: { icon: 'var(--ifrit-fire)', bg: 'rgba(239, 68, 68, 0.08)' },
  default: { icon: 'var(--ifrit-text-muted)', bg: 'var(--ifrit-bg-secondary)' },
};

export default function MetricCard({ title, value, subtext, icon: Icon, color = 'default' }) {
  const palette = colorMap[color] || colorMap.default;

  return (
    <div
      className="rounded-lg p-4 border transition-colors flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--ifrit-bg-primary)',
        borderColor: 'var(--ifrit-border)',
        minHeight: '110px'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ifrit-text-muted)' }}>
          {title}
        </span>
        {Icon && (
          <div className="p-1.5 rounded-md" style={{ backgroundColor: palette.bg }}>
            <Icon className="w-4 h-4" style={{ color: palette.icon }} />
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
          {value}
        </div>
        {subtext && (
          <div className="text-xs mt-1" style={{ color: 'var(--ifrit-text-secondary)' }}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}
