import { useState, useMemo } from 'react';
import { ALERTS, ROOMS } from '@/data/mockData';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusIndicator from '@/components/ui/StatusIndicator';
import HoverClue from '@/components/ui/HoverClue';
import { useNavigate } from 'react-router-dom';

export default function Alerts() {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');

  const filteredAlerts = useMemo(() => {
    return ALERTS.filter(alert => {
      const matchSeverity = severityFilter === 'all' || alert.severity === severityFilter;
      const matchRoom = roomFilter === 'all' || alert.roomId === roomFilter;
      return matchSeverity && matchRoom;
    });
  }, [severityFilter, roomFilter]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>System Alerts</h1>
          <HoverClue text="Daftar semua anomali yang pernah terdeteksi. Peringatan merah butuh tindakan segera. Klik sebuah baris untuk melihat CCTV lokal." />
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--agni-text-muted)' }}>History of warnings, detections, and system events.</p>
      </div>

      {/* Filters (Using Native Select for Best Mobile UX) */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
        <div className="w-full sm:w-48 relative">
          <select 
            value={severityFilter} 
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
          >
            <option value="all">All Severities</option>
            <option value="fire">Fire / Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Information</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--agni-text-muted)' }}>
            <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>

        <div className="w-full sm:w-64 relative">
          <select 
            value={roomFilter} 
            onChange={(e) => setRoomFilter(e.target.value)}
            className="w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
          >
            <option value="all">All Locations</option>
            {ROOMS.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--agni-text-muted)' }}>
            <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--agni-border)', backgroundColor: 'var(--agni-bg-tertiary)' }}>
        <Table>
          <TableHeader style={{ backgroundColor: 'var(--agni-bg-secondary)' }}>
            <TableRow style={{ borderColor: 'var(--agni-border)' }}>
              <TableHead style={{ color: 'var(--agni-text-muted)' }}>Status</TableHead>
              <TableHead style={{ color: 'var(--agni-text-muted)' }}>Timestamp</TableHead>
              <TableHead style={{ color: 'var(--agni-text-muted)' }}>Location</TableHead>
              <TableHead style={{ color: 'var(--agni-text-muted)' }}>Event Detail</TableHead>
              <TableHead className="text-right" style={{ color: 'var(--agni-text-muted)' }}>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map(alert => {
                const room = ROOMS.find(r => r.id === alert.roomId);
                const isCritical = alert.severity === 'fire';
                
                return (
                  <TableRow 
                    key={alert.id} 
                    className="cursor-pointer transition-colors hover:bg-white/5"
                    style={{ 
                      borderColor: 'var(--agni-border)',
                      backgroundColor: isCritical && !alert.acknowledged ? 'rgba(248,113,113,0.05)' : 'transparent'
                    }}
                    onClick={() => navigate(`/rooms/${alert.roomId}`)}
                  >
                    <TableCell>
                      <StatusIndicator status={alert.severity} showLabel size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--agni-text-secondary)' }}>
                      {new Date(alert.timestamp).toLocaleString('id-ID', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap" style={{ color: 'var(--agni-text-primary)' }}>
                      {room?.name} <span className="text-[10px] font-mono ml-2 opacity-50">{alert.roomId}</span>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" style={{ color: 'var(--agni-text-primary)' }}>
                      {alert.message}
                    </TableCell>
                    <TableCell className="text-right">
                      {alert.acknowledged ? (
                        <span className="text-xs" style={{ color: 'var(--agni-text-muted)' }}>Acknowledged</span>
                      ) : (
                        <span className="text-[10px] px-2 py-1 rounded bg-[var(--agni-fire)] text-white font-bold animate-pulse">
                          ACTION REQ
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center" style={{ color: 'var(--agni-text-muted)' }}>
                  No alerts match your current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
