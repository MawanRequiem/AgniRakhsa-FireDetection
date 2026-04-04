import { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusIndicator from '@/components/ui/StatusIndicator';
import HoverClue from '@/components/ui/HoverClue';
import { useNavigate } from 'react-router-dom';
import { useAlertsStore } from '@/stores/useAlertsStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Alerts() {
  const navigate = useNavigate();
  const { alerts, total, isLoading, fetchAlerts, setFilters, acknowledgeAlert } = useAlertsStore();
  const { rooms, fetchRooms } = useRoomsStore();

  const [severityFilter, setSeverityFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');

  // Fetch data on mount
  useEffect(() => {
    fetchAlerts();
    fetchRooms();
  }, [fetchAlerts, fetchRooms]);

  // Refetch when filters change
  const handleSeverityChange = useCallback((value) => {
    setSeverityFilter(value);
    setFilters({ severity: value === 'all' ? null : value });
    fetchAlerts({ severity: value === 'all' ? null : value, roomId: roomFilter === 'all' ? null : roomFilter });
  }, [setFilters, fetchAlerts, roomFilter]);

  const handleRoomChange = useCallback((value) => {
    setRoomFilter(value);
    setFilters({ roomId: value === 'all' ? null : value });
    fetchAlerts({ severity: severityFilter === 'all' ? null : severityFilter, roomId: value === 'all' ? null : value });
  }, [setFilters, fetchAlerts, severityFilter]);

  const handleAcknowledge = useCallback(async (e, alertId) => {
    e.stopPropagation();
    const success = await acknowledgeAlert(alertId);
    if (success) {
      toast.success('Alert acknowledged');
    } else {
      toast.error('Failed to acknowledge alert');
    }
  }, [acknowledgeAlert]);

  // Build room name lookup
  const roomMap = useMemo(() => {
    const map = {};
    for (const r of rooms) {
      map[r.id] = r.name;
    }
    return map;
  }, [rooms]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>System Alerts</h1>
          <HoverClue text="Daftar semua anomali yang pernah terdeteksi. Peringatan merah butuh tindakan segera. Klik sebuah baris untuk melihat CCTV lokal." />
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--agni-text-muted)' }}>
          History of warnings, detections, and system events. 
          <span className="font-mono ml-2 text-xs opacity-70">[ {total} total ]</span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
        <div className="w-full sm:w-48 relative">
          <select 
            value={severityFilter} 
            onChange={(e) => handleSeverityChange(e.target.value)}
            className="w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
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
            onChange={(e) => handleRoomChange(e.target.value)}
            className="w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)', color: 'var(--agni-text-primary)' }}
          >
            <option value="all">All Locations</option>
            {rooms.map(room => (
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
            {isLoading && alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center" style={{ color: 'var(--agni-text-muted)' }}>
                  <div className="animate-pulse">Loading alerts...</div>
                </TableCell>
              </TableRow>
            ) : alerts.length > 0 ? (
              alerts.map(alert => {
                const roomName = roomMap[alert.room_id] || alert.room_id || '—';
                const isCritical = alert.severity === 'critical' || alert.severity === 'high';
                
                return (
                  <TableRow 
                    key={alert.id} 
                    className="cursor-pointer transition-colors hover:bg-white/5"
                    style={{ 
                      borderColor: 'var(--agni-border)',
                      backgroundColor: isCritical && !alert.is_acknowledged ? 'rgba(248,113,113,0.05)' : 'transparent'
                    }}
                    onClick={() => alert.room_id && navigate(`/rooms/${alert.room_id}`)}
                  >
                    <TableCell>
                      <StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--agni-text-secondary)' }}>
                      {new Date(alert.created_at).toLocaleString('id-ID', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap" style={{ color: 'var(--agni-text-primary)' }}>
                      {roomName}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" style={{ color: 'var(--agni-text-primary)' }}>
                      {alert.message}
                    </TableCell>
                    <TableCell className="text-right">
                      {alert.is_acknowledged ? (
                        <span className="text-xs flex items-center justify-end gap-1" style={{ color: 'var(--agni-text-muted)' }}>
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleAcknowledge(e, alert.id)}
                          className="text-[10px] px-2 py-1 rounded bg-[var(--agni-fire)] text-white font-bold animate-pulse hover:opacity-80 transition-opacity"
                        >
                          ACTION REQ
                        </button>
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
