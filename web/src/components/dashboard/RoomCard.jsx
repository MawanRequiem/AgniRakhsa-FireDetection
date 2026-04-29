import { useNavigate } from 'react-router-dom';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { Activity } from 'lucide-react';

const STATUS_LABELS = {
  safe: { text: 'Safe', color: 'var(--ifrit-safe)' },
  warning: { text: 'Warning', color: '#eab308' },
  high: { text: 'High Risk', color: 'var(--ifrit-warning)' },
  critical: { text: 'Critical', color: 'var(--ifrit-fire)' },
};

export default function RoomCard({ room }) {
  const navigate = useNavigate();
  const hasOnlineDevices = room.devices?.some(d => d.status === 'online');
  const deviceCount = room.devices?.length || room.device_count || 0;
  const statusInfo = STATUS_LABELS[room.status] || STATUS_LABELS.safe;

  return (
    <button
      onClick={() => navigate(`/rooms/${room.id}`)}
      className="w-full text-left rounded-lg border p-4 transition-all cursor-pointer group"
      style={{
        backgroundColor: 'var(--ifrit-bg-primary)',
        borderColor: room.status === 'critical' ? 'var(--ifrit-fire)' 
                    : room.status === 'high' ? 'var(--ifrit-warning)'
                    : 'var(--ifrit-border)',
      }}
      onMouseEnter={(e) => { if (room.status === 'safe' || !room.status) e.currentTarget.style.borderColor = 'var(--ifrit-brand)' }}
      onMouseLeave={(e) => { 
        if (room.status === 'safe' || !room.status) e.currentTarget.style.borderColor = 'var(--ifrit-border)';
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <StatusIndicator status={room.status === 'critical' ? 'fire' : room.status} size="md" />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
            {room.name}
          </h3>
        </div>

        {/* Status badge — prominent inline */}
        <span 
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ 
            backgroundColor: `${statusInfo.color}15`,
            color: statusInfo.color,
            border: `1px solid ${statusInfo.color}30`,
          }}
        >
          {statusInfo.text}
        </span>
      </div>

      {/* Room stats */}
      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
        <span>{deviceCount} device{deviceCount !== 1 ? 's' : ''}</span>
        <span>•</span>
        <span>{room.sensor_count || 0} sensors</span>
        {room.floor && (
          <>
            <span>•</span>
            <span>{room.floor}</span>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: 'var(--ifrit-border)' }}>
        <div className="flex items-center gap-1.5">
          {hasOnlineDevices ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--ifrit-safe)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--ifrit-text-muted)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ifrit-text-muted)' }} />
              Offline
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
          {room.created_at 
            ? new Date(room.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '—'
          }
        </span>
      </div>
    </button>
  );
}
