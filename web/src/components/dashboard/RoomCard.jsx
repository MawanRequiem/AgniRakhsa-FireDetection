import { useNavigate } from 'react-router-dom';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { Clock, Activity } from 'lucide-react';

export default function RoomCard({ room }) {
  const navigate = useNavigate();

  // Determine if room has any online devices
  const hasOnlineDevices = room.devices?.some(d => d.status === 'online');
  const deviceCount = room.devices?.length || room.device_count || 0;

  return (
    <button
      onClick={() => navigate(`/rooms/${room.id}`)}
      className="w-full text-left rounded-md border p-4 transition-all cursor-pointer hover:border-[var(--agni-amber)]/40 group"
      style={{
        backgroundColor: 'var(--agni-bg-tertiary)',
        borderColor: room.status === 'critical' ? 'var(--agni-fire)' 
                    : room.status === 'high' ? 'var(--agni-warning)'
                    : 'var(--agni-border)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIndicator status={room.status === 'critical' ? 'fire' : room.status} size="md" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--agni-text-primary)' }}>
            {room.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasOnlineDevices ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-red-600 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Offline
            </span>
          )}
          {room.floor && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium" style={{
              backgroundColor: 'var(--agni-bg-secondary)',
              color: 'var(--agni-text-muted)',
              border: '1px solid var(--agni-border)',
            }}>
              {room.floor}
            </span>
          )}
        </div>
      </div>

      {/* Room stats */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>
            Devices
          </span>
          <span className="text-xs font-mono font-medium" style={{ color: 'var(--agni-text-secondary)' }}>
            {deviceCount}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>
            Sensors
          </span>
          <span className="text-xs font-mono font-medium" style={{ color: 'var(--agni-text-secondary)' }}>
            {room.sensor_count || 0}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>
            Status
          </span>
          <span className={`text-xs font-mono font-bold uppercase ${
            room.status === 'critical' ? 'text-red-500' 
            : room.status === 'high' ? 'text-amber-500'
            : room.status === 'warning' ? 'text-yellow-500' 
            : 'text-emerald-500'
          }`}>
            {room.status || 'safe'}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 mt-3 pt-2 border-t" style={{ borderColor: 'var(--agni-border)' }}>
        <Activity className="w-3 h-3" style={{ color: 'var(--agni-text-muted)' }} />
        <span className="text-[10px] font-mono" style={{ color: 'var(--agni-text-muted)' }}>
          {room.created_at 
            ? new Date(room.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '—'
          }
        </span>
      </div>
    </button>
  );
}
