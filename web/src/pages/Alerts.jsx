import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusIndicator from '@/components/ui/StatusIndicator';
import HoverClue from '@/components/ui/HoverClue';
import { useNavigate } from 'react-router-dom';
import { useAlertsStore } from '@/stores/useAlertsStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { useUIStore } from '@/store/store';
import { CheckCircle2, ShieldCheck, Image as ImageIcon, CheckSquare, Square, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { translations, getLocalizedMessage, getLocalizedExplanation } from '@/lib/translations';

export default function Alerts() {
  const navigate = useNavigate();
  const { alerts, total, page, pageSize, isLoading, fetchAlerts, setFilters, setPage, acknowledgeAlert } = useAlertsStore();
  const { rooms, fetchRooms } = useRoomsStore();
  const language = useUIStore((s) => s.language);

  const t = translations[language] || translations['en'];

  const [severityFilter, setSeverityFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [ackFilter, setAckFilter] = useState('all');
  const [selectedAlerts, setSelectedAlerts] = useState(new Set());
  const [isBulkAcknowledging, setIsBulkAcknowledging] = useState(false);
  const [acknowledgingRoom, setAcknowledgingRoom] = useState(null);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [detailAlert, setDetailAlert] = useState(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const buildFilters = useCallback((overrides = {}) => {
    const severities = overrides.severity !== undefined ? overrides.severity : severityFilter;
    const roomIds = overrides.roomId !== undefined ? overrides.roomId : roomFilter;
    const acks = overrides.ackFilter !== undefined ? overrides.ackFilter : ackFilter;

    return {
      severity: severities === 'all' ? null : severities,
      roomId: roomIds === 'all' ? null : roomIds,
      acknowledged: acks === 'all' ? null : acks !== 'active',
    };
  }, [severityFilter, roomFilter, ackFilter]);

  const doFetch = useCallback((filters) => {
    setFilters(filters);
    fetchAlerts(filters);
  }, [fetchAlerts, setFilters]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    const f = buildFilters();
    doFetch(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = useCallback((type, value) => {
    if (type === 'severity') setSeverityFilter(value);
    if (type === 'room') setRoomFilter(value);
    if (type === 'ack') setAckFilter(value);
    setSelectedAlerts(new Set());
    const severities = type === 'severity' ? value : severityFilter;
    const roomIds = type === 'room' ? value : roomFilter;
    const acks = type === 'ack' ? value : ackFilter;
    const f = {
      severity: severities === 'all' ? null : severities,
      roomId: roomIds === 'all' ? null : roomIds,
      acknowledged: acks === 'all' ? null : acks !== 'active',
    };
    doFetch(f);
  }, [doFetch, severityFilter, roomFilter, ackFilter]);

  const handlePageChange = useCallback((newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    setSelectedAlerts(new Set());
    const f = buildFilters();
    fetchAlerts({ ...f, page: newPage });
  }, [setPage, fetchAlerts, buildFilters, totalPages]);

  const handleAcknowledge = useCallback(async (e, alertId) => {
    e.stopPropagation();
    setAcknowledgingId(alertId);
    try {
      const success = await acknowledgeAlert(alertId);
      if (success) {
        toast.success(language === 'en' ? 'Alert confirmed safe' : 'Peringatan telah dikonfirmasi aman');
      } else {
        toast.error(language === 'en' ? 'Failed to confirm alert' : 'Gagal mengonfirmasi peringatan');
      }
    } finally {
      setAcknowledgingId(null);
    }
  }, [acknowledgeAlert, language]);

  const handleBulkAcknowledge = useCallback(async () => {
    setIsBulkAcknowledging(true);
    try {
      const promises = Array.from(selectedAlerts).map(id => acknowledgeAlert(id));
      const results = await Promise.all(promises);
      if (results.some(Boolean)) {
        toast.success(language === 'en' ? 'Selected alerts confirmed safe' : 'Peringatan terpilih telah dikonfirmasi aman');
        setSelectedAlerts(new Set());
      } else {
        toast.error(language === 'en' ? 'Failed to confirm alerts' : 'Gagal mengonfirmasi peringatan');
      }
    } finally {
      setIsBulkAcknowledging(false);
    }
  }, [selectedAlerts, acknowledgeAlert, language]);

  const roomMap = useMemo(() => {
    const map = {};
    for (const r of rooms) {
      map[r.id] = r.name;
    }
    return map;
  }, [rooms]);

  const groupedAlerts = useMemo(() => {
    const groups = {};
    for (const alert of alerts) {
      const roomName = roomMap[alert.room_id] || alert.room_id || (language === 'en' ? 'Unknown Room' : 'Ruangan Tidak Diketahui');
      if (!groups[roomName]) {
        groups[roomName] = { roomId: alert.room_id, alerts: [] };
      }
      groups[roomName].alerts.push(alert);
    }
    return groups;
  }, [alerts, roomMap, language]);

  const locale = language === 'en' ? 'en-US' : 'id-ID';

  const toggleSelectAll = useCallback((roomAlerts) => {
    const newSelected = new Set(selectedAlerts);
    const allSelected = roomAlerts.every(a => newSelected.has(a.id));
    if (allSelected) {
      roomAlerts.forEach(a => newSelected.delete(a.id));
    } else {
      roomAlerts.forEach(a => newSelected.add(a.id));
    }
    setSelectedAlerts(newSelected);
  }, [selectedAlerts]);

  const toggleSelectOne = useCallback((alertId) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) {
      newSelected.delete(alertId);
    } else {
      newSelected.add(alertId);
    }
    setSelectedAlerts(newSelected);
  }, [selectedAlerts]);

  const getBorderLeftColor = (severity, isAcknowledged) => {
    if (!isAcknowledged && (severity === 'critical' || severity === 'high')) return 'var(--ifrit-fire)';
    if (!isAcknowledged && (severity === 'medium' || severity === 'warning')) return 'var(--ifrit-warning)';
    return 'var(--ifrit-border)';
  };

  const getRowBgColor = (severity, isAcknowledged) => {
    if (!isAcknowledged && (severity === 'critical' || severity === 'high')) return 'rgba(248, 113, 113, 0.08)';
    return 'transparent';
  };

  const formatTimestamp = (dateStr) => {
    return new Date(dateStr).toLocaleString(locale, {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  const formatTimestampShort = (dateStr) => {
    return new Date(dateStr).toLocaleString(locale, {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const renderPagination = () => (
    <div className="flex items-center justify-between p-4 rounded-lg border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
      <span className="text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>
        {language === 'en'
          ? `Page ${page} of ${totalPages} (${total} total alerts)`
          : `Halaman ${page} dari ${totalPages} (${total} total peringatan)`}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page <= 1 || isLoading}
          className="inline-flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-md border transition-all duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
          style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
        >
          <ChevronLeft className="w-4 h-4" /> {language === 'en' ? 'Previous' : 'Sebelumnya'}
        </button>
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page >= totalPages || isLoading}
          className="inline-flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-md border transition-all duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
          style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
        >
          {language === 'en' ? 'Next' : 'Berikutnya'} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderDetailModal = () => {
    if (!detailAlert) return null;
    const imageUrl = detailAlert.image_url || detailAlert.snapshot_url;
    const roomName = roomMap[detailAlert.room_id] || detailAlert.room_id || '-';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setDetailAlert(null)}>
        <div
          className="relative w-full max-w-lg rounded-lg border shadow-lg overflow-y-auto max-h-[90vh]"
          style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-3">
              <StatusIndicator status={detailAlert.severity === 'critical' ? 'fire' : detailAlert.severity === 'high' ? 'warning' : 'info'} size="sm" />
              <span className="font-semibold text-sm" style={{ color: 'var(--ifrit-text-primary)' }}>
                {language === 'en' ? 'Alert Detail' : 'Detail Peringatan'}
              </span>
            </div>
            <button
              onClick={() => setDetailAlert(null)}
              className="p-2 rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
              aria-label={language === 'en' ? 'Close detail' : 'Tutup detail'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {imageUrl && (
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--ifrit-border)' }}>
                <img src={imageUrl} alt={language === 'en' ? 'Detection image' : 'Gambar deteksi'} className="w-full object-cover max-h-64" />
              </div>
            )}

            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                  {language === 'en' ? 'Event Message' : 'Pesan Kejadian'}
                </div>
                <div className="text-sm font-medium leading-snug" style={{ color: 'var(--ifrit-text-primary)' }}>
                  {getLocalizedMessage(detailAlert.message, language)}
                </div>
              </div>

              {getLocalizedExplanation(detailAlert.message, language) && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {language === 'en' ? 'Explanation' : 'Penjelasan'}
                  </div>
                  <div className="text-sm italic leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {getLocalizedExplanation(detailAlert.message, language)}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {language === 'en' ? 'Risk Level' : 'Tingkat Bahaya'}
                  </div>
                  <StatusIndicator status={detailAlert.severity === 'critical' ? 'fire' : detailAlert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {language === 'en' ? 'Room' : 'Ruangan'}
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>{roomName}</span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {language === 'en' ? 'Detection Time' : 'Waktu Deteksi'}
                  </div>
                  <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>
                    {formatTimestamp(detailAlert.created_at)}
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {language === 'en' ? 'Status' : 'Status'}
                  </div>
                  <span className="text-sm font-medium" style={{ color: detailAlert.is_acknowledged ? 'var(--ifrit-safe)' : 'var(--ifrit-warning)' }}>
                    {detailAlert.is_acknowledged
                      ? (language === 'en' ? 'Confirmed Safe' : 'Sudah Aman')
                      : (language === 'en' ? 'Unacknowledged' : 'Belum Dikonfirmasi')}
                  </span>
                </div>
                {detailAlert.acknowledged_at && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {language === 'en' ? 'Acknowledged At' : 'Dikonfirmasi Pada'}
                    </div>
                    <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>
                      {formatTimestamp(detailAlert.acknowledged_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!detailAlert.is_acknowledged && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--ifrit-border)' }}>
                <button
                  onClick={(e) => {
                    handleAcknowledge(e, detailAlert.id);
                    setDetailAlert(null);
                  }}
                  disabled={acknowledgingId === detailAlert.id}
                  className="inline-flex items-center justify-center gap-4 text-sm font-semibold px-4 py-2 min-h-[44px] rounded-md w-full transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                  style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                >
                  {acknowledgingId === detailAlert.id ? (
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }}></div>
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {language === 'en' ? 'Confirm Safe' : 'Konfirmasi Aman'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-9">
      {renderDetailModal()}

      <div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ifrit-text-primary)' }}>
            {language === 'en' ? 'Fire Warning & Alerts History' : 'Notifikasi Peringatan Kebakaran'}
          </h1>
          <HoverClue text={language === 'en' ? 'Paginated alert feed grouped by room. Filter by severity, room, or acknowledgment status. Click any row for full detail.' : 'Umpan peringatan dengan halaman, dikelompokkan per ruangan. Filter berdasarkan tingkat bahaya, ruangan, atau status konfirmasi. Klik baris untuk detail lengkap.'} />
        </div>
        <p className="text-sm mt-4 font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
          {language === 'en' ? 'History of all alerts, sensor telemetry anomalies, and fire status.' : 'Riwayat semua peringatan, deteksi sensor, dan status sistem keamanan.'}
          <span className="ml-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-secondary)', border: '1px solid var(--ifrit-border)' }}>
            {total} {language === 'en' ? 'total' : 'total'}
          </span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <div className="w-full sm:w-48">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Severity' : 'Tingkat Bahaya'}
          </label>
          <div className="relative">
            <select
              value={severityFilter}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="w-full appearance-none rounded-md border py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] cursor-pointer transition-shadow"
              style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
            >
              <option value="all">{t['all_severities']}</option>
              <option value="critical">{language === 'en' ? 'Very Critical (Hazardous)' : 'Sangat Kritis (Bahaya Besar)'}</option>
              <option value="high">{language === 'en' ? 'High' : 'Tinggi (Bahaya)'}</option>
              <option value="medium">{language === 'en' ? 'Medium (Warning)' : 'Sedang (Waspada)'}</option>
              <option value="low">{language === 'en' ? 'Low (Safe/Normal)' : 'Rendah (Aman/Normal)'}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--ifrit-text-muted)' }}>
              <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Room Location' : 'Lokasi Ruangan'}
          </label>
          <div className="relative">
            <select
              value={roomFilter}
              onChange={(e) => handleFilterChange('room', e.target.value)}
              className="w-full appearance-none rounded-md border py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] cursor-pointer transition-shadow"
              style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
            >
              <option value="all">{t['all_rooms']}</option>
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

        <div className="w-full sm:w-48">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Status' : 'Status'}
          </label>
          <div className="relative">
            <select
              value={ackFilter}
              onChange={(e) => handleFilterChange('ack', e.target.value)}
              className="w-full appearance-none rounded-md border py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] cursor-pointer transition-shadow"
              style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
            >
              <option value="all">{language === 'en' ? 'All Statuses' : 'Semua Status'}</option>
              <option value="active">{language === 'en' ? 'Unacknowledged' : 'Belum Dikonfirmasi'}</option>
              <option value="acknowledged">{language === 'en' ? 'Acknowledged' : 'Sudah Dikonfirmasi'}</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3" style={{ color: 'var(--ifrit-text-muted)' }}>
              <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Pagination (top) */}
      {totalPages > 1 && renderPagination()}

      {/* Bulk Action Bar */}
      {selectedAlerts.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border animate-in fade-in slide-in-from-top-2 motion-reduce:animate-none" style={{ backgroundColor: 'var(--ifrit-brand)', borderColor: 'var(--ifrit-brand)', color: 'white' }}>
          <div className="flex items-center gap-4">
            <CheckSquare className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold text-sm">
              {selectedAlerts.size} {language === 'en' ? 'alerts selected' : 'peringatan dipilih'}
            </span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setSelectedAlerts(new Set())}
              disabled={isBulkAcknowledging}
              className="flex-1 sm:flex-none text-sm font-medium px-4 py-2 rounded hover:bg-white/10 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {language === 'en' ? 'Cancel' : 'Batal'}
            </button>
            <button
              onClick={handleBulkAcknowledge}
              disabled={isBulkAcknowledging}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-4 text-sm font-semibold px-4 py-2 rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-brand)]"
              style={{ backgroundColor: 'white', color: 'var(--ifrit-brand)' }}
            >
              {isBulkAcknowledging ? (
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'var(--ifrit-brand)', borderTopColor: 'transparent' }}></div>
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {language === 'en' ? 'Confirm Selected Safe' : 'Konfirmasi Terpilih Aman'}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card View (sm:hidden) */}
      <div className="space-y-4 sm:hidden">
        {isLoading && Object.keys(groupedAlerts).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-9">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)' }}></div>
            <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
              {language === 'en' ? 'Scanning alert feed...' : 'Memuat data peringatan...'}
            </span>
          </div>
        ) : Object.keys(groupedAlerts).length > 0 ? (
          Object.entries(groupedAlerts).map(([roomName, group]) => {
            const allSelected = group.alerts.every(a => selectedAlerts.has(a.id));
            const hasUnacknowledged = group.alerts.some(a => !a.is_acknowledged);

            return (
              <div key={roomName} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleSelectAll(group.alerts)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
                      aria-label={language === 'en' ? 'Select all in room' : 'Pilih semua di ruangan'}
                    >
                      {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="font-semibold text-sm" style={{ color: 'var(--ifrit-text-primary)' }}>
                      {roomName}
                      <span className="ml-4 text-xs px-4 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', color: 'var(--ifrit-text-muted)', border: '1px solid var(--ifrit-border)' }}>
                        {group.alerts.length} {language === 'en' ? 'alerts' : 'peringatan'}
                      </span>
                    </span>
                  </div>
                  {hasUnacknowledged && (
                    <button
                      onClick={async () => {
                        setAcknowledgingRoom(roomName);
                        try {
                          const promises = group.alerts.filter(a => !a.is_acknowledged).map(a => acknowledgeAlert(a.id));
                          const results = await Promise.all(promises);
                          if (results.some(Boolean)) {
                            toast.success(language === 'en' ? 'Room alerts confirmed safe' : 'Peringatan ruangan telah dikonfirmasi aman');
                          }
                        } finally {
                          setAcknowledgingRoom(null);
                        }
                      }}
                      disabled={acknowledgingRoom === roomName}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-4 text-xs font-semibold px-4 py-2 min-h-[44px] rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-secondary)]"
                      style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                    >
                      {acknowledgingRoom === roomName ? (
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }}></div>
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {language === 'en' ? 'Acknowledge All' : 'Konfirmasi Semua'}
                    </button>
                  )}
                </div>

                {group.alerts.map(alert => {
                  const imageUrl = alert.image_url || alert.snapshot_url;
                  return (
                    <div
                      key={alert.id}
                      onClick={() => setDetailAlert(alert)}
                      className="p-4 rounded-lg border relative cursor-pointer"
                      style={{
                        borderColor: 'var(--ifrit-border)',
                        borderLeftWidth: '4px',
                        borderLeftStyle: 'solid',
                        borderLeftColor: getBorderLeftColor(alert.severity, alert.is_acknowledged),
                        backgroundColor: getRowBgColor(alert.severity, alert.is_acknowledged)
                      }}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <button
                            role="checkbox"
                            aria-checked={selectedAlerts.has(alert.id)}
                            onClick={(e) => { e.stopPropagation(); toggleSelectOne(alert.id); }}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] flex-shrink-0"
                            aria-label={language === 'en' ? 'Select alert' : 'Pilih peringatan'}
                          >
                            {selectedAlerts.has(alert.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                          </button>
                          <StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                          <span className="font-mono text-xs whitespace-nowrap tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>
                            {formatTimestampShort(alert.created_at)}
                          </span>
                        </div>
                        {imageUrl && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(imageUrl, '_blank'); }}
                            className="w-16 h-16 rounded overflow-hidden border flex-shrink-0 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
                            style={{ borderColor: 'var(--ifrit-border)' }}
                            aria-label={language === 'en' ? 'View full alert image' : 'Lihat gambar peringatan penuh'}
                          >
                            <img src={imageUrl} alt={language === 'en' ? 'Alert preview' : 'Pratinjau peringatan'} className="w-full h-full object-cover" />
                          </button>
                        )}
                      </div>

                      <div className="mb-4 pl-11">
                        <div className="text-sm font-medium leading-snug mb-1" style={{ color: 'var(--ifrit-text-primary)' }}>
                          {getLocalizedMessage(alert.message, language)}
                        </div>
                        {getLocalizedExplanation(alert.message, language) && (
                          <div className="text-xs italic leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>
                            {getLocalizedExplanation(alert.message, language)}
                          </div>
                        )}
                      </div>

                      <div className="pl-11">
                        {alert.is_acknowledged ? (
                          <span className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-md w-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--ifrit-safe)' }}>
                            <CheckCircle2 className="w-4 h-4" /> {language === 'en' ? 'Confirmed Safe' : 'Sudah Aman'}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => handleAcknowledge(e, alert.id)}
                            disabled={acknowledgingId === alert.id}
                            className="inline-flex items-center justify-center gap-4 text-sm font-semibold px-4 py-2 min-h-[44px] rounded-md w-full transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                            style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                          >
                            {acknowledgingId === alert.id ? (
                              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }}></div>
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            {t['confirm_now'] || 'Confirm'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-9">
            <ShieldCheck className="w-8 h-8 opacity-40" style={{ color: 'var(--ifrit-safe)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
              {language === 'en' ? 'No alerts match your filters' : 'Tidak ada peringatan yang cocok'}
            </span>
            <span className="text-xs text-center px-4" style={{ color: 'var(--ifrit-text-muted)' }}>
              {language === 'en' ? 'Try adjusting the severity, room, or status filters.' : 'Coba sesuaikan filter tingkat bahaya, ruangan, atau status.'}
            </span>
          </div>
        )}
      </div>

      {/* Desktop Table View (hidden sm:block) */}
      <div className="hidden sm:block border rounded-lg overflow-x-auto shadow-sm" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
        <Table>
          <TableHeader style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <TableRow style={{ borderColor: 'var(--ifrit-border)' }}>
              <TableHead className="w-12" style={{ color: 'var(--ifrit-text-muted)' }}>
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead className="w-24" style={{ color: 'var(--ifrit-text-muted)' }}>{language === 'en' ? 'Preview' : 'Pratinjau'}</TableHead>
              <TableHead className="w-48" style={{ color: 'var(--ifrit-text-muted)' }}>{language === 'en' ? 'Detection Time' : 'Waktu Deteksi'}</TableHead>
              <TableHead className="w-32" style={{ color: 'var(--ifrit-text-muted)' }}>{language === 'en' ? 'Risk Level' : 'Tingkat Bahaya'}</TableHead>
              <TableHead style={{ color: 'var(--ifrit-text-muted)' }}>{language === 'en' ? 'Event Message' : 'Detail Kejadian'}</TableHead>
              <TableHead className="text-right w-40" style={{ color: 'var(--ifrit-text-muted)' }}>{t['actions']}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Object.keys(groupedAlerts).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)' }}></div>
                    <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {language === 'en' ? 'Scanning alert feed...' : 'Memuat data peringatan...'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : Object.keys(groupedAlerts).length > 0 ? (
              Object.entries(groupedAlerts).map(([roomName, group]) => {
                const allSelected = group.alerts.every(a => selectedAlerts.has(a.id));
                const hasUnacknowledged = group.alerts.some(a => !a.is_acknowledged);

                return (
                  <Fragment key={roomName}>
                    <TableRow className="bg-black/20" style={{ borderColor: 'var(--ifrit-border)' }}>
                      <TableCell colSpan={6} className="py-3 px-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleSelectAll(group.alerts)}
                              className="p-2 -ml-2 rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
                              aria-label={language === 'en' ? 'Select all in room' : 'Pilih semua di ruangan'}
                            >
                              {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                            <span className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--ifrit-text-primary)' }}>
                              {roomName}
                              <span className="text-xs px-4 py-1 rounded-full font-medium" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-muted)', border: '1px solid var(--ifrit-border)' }}>
                                {group.alerts.length} {language === 'en' ? 'alerts' : 'peringatan'}
                              </span>
                            </span>
                          </div>
                          {hasUnacknowledged && (
                            <button
                              onClick={async () => {
                                setAcknowledgingRoom(roomName);
                                try {
                                  const promises = group.alerts.filter(a => !a.is_acknowledged).map(a => acknowledgeAlert(a.id));
                                  const results = await Promise.all(promises);
                                  if (results.some(Boolean)) {
                                    toast.success(language === 'en' ? 'Room alerts confirmed safe' : 'Peringatan ruangan telah dikonfirmasi aman');
                                  }
                                } finally {
                                  setAcknowledgingRoom(null);
                                }
                              }}
                              disabled={acknowledgingRoom === roomName}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                              style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                            >
                              {acknowledgingRoom === roomName ? (
                                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }}></div>
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              {language === 'en' ? 'Acknowledge All in Room' : 'Konfirmasi Semua di Ruangan'}
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {group.alerts.map(alert => {
                      const imageUrl = alert.image_url || alert.snapshot_url;

                      return (
                        <TableRow
                          key={alert.id}
                          onClick={() => setDetailAlert(alert)}
                          className="transition-colors hover:bg-white/5 cursor-pointer"
                          style={{
                            borderColor: 'var(--ifrit-border)',
                            borderLeftWidth: '4px',
                            borderLeftStyle: 'solid',
                            borderLeftColor: getBorderLeftColor(alert.severity, alert.is_acknowledged),
                            backgroundColor: getRowBgColor(alert.severity, alert.is_acknowledged)
                          }}
                        >
                          <TableCell className="align-middle">
                            <button
                              role="checkbox"
                              aria-checked={selectedAlerts.has(alert.id)}
                              onClick={(e) => { e.stopPropagation(); toggleSelectOne(alert.id); }}
                              className="p-1.5 rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                              aria-label={language === 'en' ? 'Select alert' : 'Pilih peringatan'}
                            >
                              {selectedAlerts.has(alert.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </TableCell>
                          <TableCell className="align-middle">
                            {imageUrl ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); window.open(imageUrl, '_blank'); }}
                                className="w-16 h-12 rounded overflow-hidden border cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                                style={{ borderColor: 'var(--ifrit-border)' }}
                                aria-label={language === 'en' ? 'View full alert image' : 'Lihat gambar peringatan penuh'}
                              >
                                <img src={imageUrl} alt={language === 'en' ? 'Alert preview' : 'Pratinjau peringatan'} className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-16 h-12 rounded flex items-center justify-center border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                                <ImageIcon className="w-5 h-5 opacity-40" style={{ color: 'var(--ifrit-text-muted)' }} />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-middle font-mono text-sm whitespace-nowrap tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>
                            {formatTimestamp(alert.created_at)}
                          </TableCell>
                          <TableCell className="align-middle">
                            <StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                          </TableCell>
                          <TableCell className="align-middle max-w-[400px]">
                            <div className="text-sm font-medium leading-snug" style={{ color: 'var(--ifrit-text-primary)' }}>
                              {getLocalizedMessage(alert.message, language)}
                            </div>
                            {getLocalizedExplanation(alert.message, language) && (
                              <div className="text-sm mt-1 italic leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>
                                {getLocalizedExplanation(alert.message, language)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="align-middle text-right">
                            {alert.is_acknowledged ? (
                              <span className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--ifrit-safe)' }}>
                                <CheckCircle2 className="w-4 h-4" /> {language === 'en' ? 'Confirmed Safe' : 'Sudah Aman'}
                              </span>
                            ) : (
                              <button
                                onClick={(e) => handleAcknowledge(e, alert.id)}
                                disabled={acknowledgingId === alert.id}
                                className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                                style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                              >
                                {acknowledgingId === alert.id ? (
                                  <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }}></div>
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                {t['confirm_now'] || 'Confirm'}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <ShieldCheck className="w-8 h-8 opacity-40" style={{ color: 'var(--ifrit-safe)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
                      {language === 'en' ? 'No alerts match your filters' : 'Tidak ada peringatan yang cocok'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {language === 'en' ? 'Try adjusting the severity, room, or status filters.' : 'Coba sesuaikan filter tingkat bahaya, ruangan, atau status.'}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination (bottom) */}
      {renderPagination()}
    </div>
  );
}
