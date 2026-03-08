import { useNavigate } from 'react-router-dom';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { SENSOR_READINGS, SENSOR_TYPES } from '@/data/mockData';
import { Clock } from 'lucide-react';

export default function RoomCard({ room }) {
  const navigate = useNavigate();
  const readings = SENSOR_READINGS[room.id];

  return (
    <button
      onClick={() => navigate(`/rooms/${room.id}`)}
      className="w-full text-left rounded-md border p-4 transition-all cursor-pointer hover:border-[var(--agni-amber)]/40 group"
      style={{
        backgroundColor: 'var(--agni-bg-tertiary)',
        borderColor: room.status === 'fire' ? 'var(--agni-fire)' : 'var(--agni-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIndicator status={room.status} size="md" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--agni-text-primary)' }}>
            {room.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {room.sensorStatus === 'offline' ? (
            <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Offline
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium" style={{
            backgroundColor: 'var(--agni-bg-secondary)',
            color: 'var(--agni-text-muted)',
            border: '1px solid var(--agni-border)'
          }}>
            {room.floor}
          </span>
        </div>
      </div>

      {/* Sensor Mini Bars */}
      <div className="space-y-1.5">
        {SENSOR_TYPES.slice(0, 3).map(sensor => {
          const value = readings?.[sensor.key] || 0;
          const pct = Math.min((value / sensor.warnMax) * 100, 100);
          const barColor = value > sensor.warnMax ? 'var(--agni-fire)'
                         : value > sensor.safeMax ? 'var(--agni-warning)'
                         : 'var(--agni-safe)';
          return (
            <div key={sensor.key} className="flex items-center gap-2">
              <span className="text-[10px] font-mono w-10" style={{ color: 'var(--agni-text-muted)' }}>
                {sensor.label}
              </span>
              <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: 'var(--agni-bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
              <span className="text-[10px] font-mono w-8 text-right" style={{ color: 'var(--agni-text-secondary)' }}>
                {value}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t" style={{ borderColor: 'var(--agni-border)' }}>
        <Clock className="w-3 h-3" style={{ color: 'var(--agni-text-muted)' }} />
        <span className="text-[10px] font-mono" style={{ color: 'var(--agni-text-muted)' }}>
          {new Date(room.lastUpdated).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    </button>
  );
}
