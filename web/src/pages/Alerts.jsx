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
      toast.success('Peringatan telah dikonfirmasi aman');
    } else {
      toast.error('Gagal mengonfirmasi peringatan');
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
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Notifikasi Peringatan Kebakaran</h1>
          <HoverClue text="Daftar riwayat semua masalah terdeteksi. Baris merah membutuhkan perhatian segera. Klik baris untuk melihat kamera ruangan." />
        </div>
        <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>
          Riwayat semua peringatan, deteksi sensor, dan status sistem keamanan. 
          <span className="font-mono ml-2 text-xs opacity-70">[ Total: {total} ]</span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <div className="w-full sm:w-48 relative">
          <select 
            value={severityFilter} 
            onChange={(e) => handleSeverityChange(e.target.value)}
            className="w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            <option value="all">Semua Tingkat Bahaya</option>
            <option value="critical">Sangat Kritis (Bahaya Besar)</option>
            <option value="high">Tinggi (Bahaya)</option>
            <option value="medium">Sedang (Waspada)</option>
            <option value="low">Rendah (Aman/Normal)</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--ifrit-text-muted)' }}>
            <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>

        <div className="w-full sm:w-64 relative">
          <select 
            value={roomFilter} 
            onChange={(e) => handleRoomChange(e.target.value)}
            className="w-full appearance-none rounded-lg border py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            <option value="all">Semua Lokasi</option>
            {rooms.map(room => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--ifrit-text-muted)' }}>
            <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
        <Table>
          <TableHeader style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <TableRow style={{ borderColor: 'var(--ifrit-border)' }}>
              <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Tingkat Bahaya</TableHead>
              <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Waktu Deteksi</TableHead>
              <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Lokasi Ruangan</TableHead>
              <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>Detail Kejadian</TableHead>
              <TableHead className="text-right" style={{ color: 'var(--ifrit-text-muted)' }}>Tindakan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && alerts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center" style={{ color: 'var(--ifrit-text-muted)' }}>
                  <div className="animate-pulse">Memuat peringatan...</div>
                </TableCell>
              </TableRow>
            ) : alerts.length > 0 ? (
              alerts.map(alert => {
                const roomName = roomMap[alert.room_id] || alert.room_id || '-';
                const isCritical = alert.severity === 'critical' || alert.severity === 'high';
                
                return (
                  <TableRow 
                    key={alert.id} 
                    className="cursor-pointer transition-colors hover:bg-white/5"
                    style={{ 
                      borderColor: 'var(--ifrit-border)',
                      backgroundColor: isCritical && !alert.is_acknowledged ? 'rgba(248,113,113,0.05)' : 'transparent'
                    }}
                    onClick={() => alert.room_id && navigate(`/dashboard/rooms/${alert.room_id}`)}
                  >
                    <TableCell>
                      <StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-nowrap" style={{ color: 'var(--ifrit-text-secondary)' }}>
                      {new Date(alert.created_at).toLocaleString('id-ID', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' 
                      })}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap" style={{ color: 'var(--ifrit-text-primary)' }}>
                      {roomName}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" style={{ color: 'var(--ifrit-text-primary)' }}>
                      {alert.message}
                    </TableCell>
                    <TableCell className="text-right">
                      {alert.is_acknowledged ? (
                        <span className="text-xs flex items-center justify-end gap-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                          <CheckCircle2 className="w-3 h-3" /> Sudah Aman
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleAcknowledge(e, alert.id)}
                          className="text-[10px] px-2.5 py-1 rounded bg-[var(--ifrit-fire)] text-white font-bold led-fire hover:opacity-80 transition-opacity"
                        >
                          KONFIRMASI SEKARANG
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center" style={{ color: 'var(--ifrit-text-muted)' }}>
                  Tidak ada peringatan yang cocok dengan filter saat ini.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
