import { useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import RoomCard from '@/components/dashboard/RoomCard';
import { useRoomsStore } from '@/stores/useRoomsStore';

export default function Rooms() {
  const { rooms, isLoading, fetchRooms } = useRoomsStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(() => {
      if (!document.hidden) fetchRooms();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const filteredRooms = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.toLowerCase();
    return rooms.filter(r => 
      r.name?.toLowerCase().includes(q) || 
      r.floor?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
    );
  }, [rooms, search]);

  // Summary counts
  const statusCounts = useMemo(() => {
    const counts = { safe: 0, warning: 0, high: 0, critical: 0 };
    for (const r of rooms) {
      if (counts[r.status] !== undefined) counts[r.status]++;
      else counts.safe++;
    }
    return counts;
  }, [rooms]);

  if (isLoading && rooms.length === 0) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Facility Rooms</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-36 rounded-lg border animate-pulse" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Facility Map</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>
            Select an area to view live video and sensor status.
          </p>
        </div>
      </div>

      {/* Status Summary + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusPill label="All" count={rooms.length} active />
          {statusCounts.critical > 0 && <StatusPill label="Critical" count={statusCounts.critical} color="var(--ifrit-fire)" />}
          {statusCounts.high > 0 && <StatusPill label="High" count={statusCounts.high} color="var(--ifrit-warning)" />}
          {statusCounts.warning > 0 && <StatusPill label="Warning" count={statusCounts.warning} color="#eab308" />}
          <StatusPill label="Safe" count={statusCounts.safe} color="var(--ifrit-safe)" />
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ifrit-text-muted)' }} />
          <input
            type="text"
            placeholder="Search rooms..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm rounded-lg border w-full sm:w-64 outline-none"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          />
        </div>
      </div>

      {/* Room Grid — flat, no tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredRooms.map(room => (
          <RoomCard key={room.id} room={room} />
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div 
          className="flex flex-col items-center justify-center p-12 rounded-lg border border-dashed"
          style={{ borderColor: 'var(--ifrit-border)' }}
        >
          <h3 className="font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>No rooms found</h3>
          <p className="text-sm text-center max-w-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>
            {search ? `No rooms match "${search}". Try a different search.` : 'No monitored rooms have been configured yet.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Simple status count pill (read-only, not a tab)
function StatusPill({ label, count, color, active }) {
  return (
    <span 
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
      style={{ 
        backgroundColor: active ? 'var(--ifrit-bg-tertiary)' : 'transparent',
        color: color || 'var(--ifrit-text-secondary)',
        border: active ? '1px solid var(--ifrit-border)' : '1px solid transparent',
      }}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className="font-mono font-bold" style={{ color: 'var(--ifrit-text-muted)' }}>{count}</span>
    </span>
  );
}
