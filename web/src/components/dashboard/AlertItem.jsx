import StatusIndicator from '@/components/ui/StatusIndicator';
import { ROOMS } from '@/data/mockData';
import { AlertTriangle, Flame, Info } from 'lucide-react';

const severityIcons = {
  fire: Flame,
  warning: AlertTriangle,
  info: Info,
};

export default function AlertItem({ alert, compact = false }) {
  const room = ROOMS.find(r => r.id === alert.roomId);
  const Icon = severityIcons[alert.severity] || Info;
  const isCritical = alert.severity === 'fire';

  return (
    <div
      className="flex items-start gap-3 px-3 py-2.5 rounded-md border-l-2 transition-colors relative"
      style={{
        backgroundColor: isCritical ? 'rgba(248, 113, 113, 0.05)' : 'transparent',
        borderLeftColor: isCritical ? 'var(--agni-fire)'
          : alert.severity === 'warning' ? 'var(--agni-warning)'
          : 'var(--agni-border)',
      }}
    >
      {/* Hazard stripe for critical */}
      {isCritical && !alert.acknowledged && (
        <div className="absolute inset-0 hazard-stripe rounded-md pointer-events-none" />
      )}

      <div className="relative flex-shrink-0 mt-0.5">
        <Icon
          className="w-4 h-4"
          style={{
            color: alert.severity === 'fire' ? 'var(--agni-fire)'
              : alert.severity === 'warning' ? 'var(--agni-warning)'
              : 'var(--agni-text-muted)',
          }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <StatusIndicator status={alert.severity} size="sm" />
          <span className="text-xs font-medium" style={{ color: 'var(--agni-text-primary)' }}>
            {room?.name || alert.roomId}
          </span>
          {!alert.acknowledged && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-medium"
              style={{ backgroundColor: 'rgba(248, 113, 113, 0.15)', color: 'var(--agni-fire)' }}>
              NEW
            </span>
          )}
        </div>
        {!compact && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--agni-text-secondary)' }}>
            {alert.message}
          </p>
        )}
        <span className="text-[10px] font-mono mt-1 block" style={{ color: 'var(--agni-text-muted)' }}>
          {new Date(alert.timestamp).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}
