import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusIndicator from '@/components/ui/StatusIndicator';
import HoverClue from '@/components/ui/HoverClue';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsStore } from '@/stores/useAlertsStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { useUIStore } from '@/store/store';
import { CheckCircle2, ShieldCheck, Image as ImageIcon, CheckSquare, Square, ChevronLeft, ChevronRight, X, Thermometer, Droplets, Flame, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { translations, getLocalizedMessage, getLocalizedExplanation } from '@/lib/translations';

const PER_PAGE = 15;

export default function Alerts() {
  const { roomsData, globalLoading, roomSummaries, isAcknowledgingRoom, fetchRoomPage, fetchAllFirstPages, setFilters, acknowledgeAlert, acknowledgeRoom, setAcknowledgingRoom } = useAlertsStore();
  const { rooms, fetchRooms } = useRoomsStore();
  const language = useUIStore((s) => s.language);
  const t = translations[language] || translations['en'];

  const [severityFilter, setSeverityFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [ackFilter, setAckFilter] = useState('active');
  const [selectedAlerts, setSelectedAlerts] = useState(new Set());
  const [isBulkAcknowledging, setIsBulkAcknowledging] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [detailAlert, setDetailAlert] = useState(null);

  const buildFilters = useCallback((overrides = {}) => {
    const sev = overrides.severity !== undefined ? overrides.severity : severityFilter;
    const rm = overrides.roomId !== undefined ? overrides.roomId : roomFilter;
    const ack = overrides.ackFilter !== undefined ? overrides.ackFilter : ackFilter;
    return {
      severity: sev === 'all' ? null : sev,
      roomId: rm === 'all' ? null : rm,
      acknowledged: ack === 'all' ? null : ack !== 'active',
    };
  }, [severityFilter, roomFilter, ackFilter]);

  const doFetch = useCallback((filters) => {
    setFilters(filters);
    fetchAllFirstPages(filters);
  }, [fetchAllFirstPages, setFilters]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    const f = buildFilters();
    doFetch(f);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!detailAlert) return;
    const handler = (e) => { if (e.key === 'Escape') setDetailAlert(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [detailAlert]);

  const handleFilterChange = useCallback((type, value) => {
    if (type === 'severity') setSeverityFilter(value);
    if (type === 'room') setRoomFilter(value);
    if (type === 'ack') setAckFilter(value);
    setSelectedAlerts(new Set());
    const sev = type === 'severity' ? value : severityFilter;
    const rm = type === 'room' ? value : roomFilter;
    const ack = type === 'ack' ? value : ackFilter;
    const f = {
      severity: sev === 'all' ? null : sev,
      roomId: rm === 'all' ? null : rm,
      acknowledged: ack === 'all' ? null : ack !== 'active',
    };
    doFetch(f);
  }, [doFetch, severityFilter, roomFilter, ackFilter]);

  const handleRoomPageChange = useCallback((roomId, newPage, maxPage) => {
    if (newPage < 1 || newPage > maxPage) return;
    setSelectedAlerts(new Set());
    fetchRoomPage(roomId, newPage);
  }, [fetchRoomPage]);

  const handleAcknowledge = useCallback(async (e, alertId, roomId) => {
    e.stopPropagation();
    setAcknowledgingId(alertId);
    try {
      const success = await acknowledgeAlert(alertId, roomId);
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
      const byRoom = {};
      for (const alertId of selectedAlerts) {
        for (const [rid, data] of Object.entries(roomsData)) {
          const found = data.alerts.find((a) => a.id === alertId);
          if (found) {
            if (!byRoom[rid]) byRoom[rid] = [];
            byRoom[rid].push(alertId);
            break;
          }
        }
      }
      const promises = [];
      for (const [rid, ids] of Object.entries(byRoom)) {
        ids.forEach((id) => promises.push(acknowledgeAlert(id, rid)));
      }
      const results = await Promise.all(promises);
      if (results.some(Boolean)) {
        toast.success(language === 'en' ? 'Selected alerts confirmed safe' : 'Peringatan terpilih telah dikonfirmasi aman');
        setSelectedAlerts(new Set());
      }
    } finally {
      setIsBulkAcknowledging(false);
    }
  }, [selectedAlerts, roomsData, acknowledgeAlert, language]);

  const handleAcknowledgeRoom = useCallback(async (roomId, roomName) => {
    setAcknowledgingRoom(roomId);
    try {
      const result = await acknowledgeRoom(roomId);
      if (result && result.acknowledged_count > 0) {
        toast.success(language === 'en'
          ? `${result.acknowledged_count} alerts in ${roomName} confirmed safe`
          : `${result.acknowledged_count} peringatan di ${roomName} dikonfirmasi aman`);
        const currentData = roomsData[roomId];
        if (currentData) {
          fetchRoomPage(roomId, currentData.page);
        }
      } else {
        toast.info(language === 'en' ? 'No unacknowledged alerts in this room' : 'Tidak ada peringatan yang perlu dikonfirmasi');
      }
    } catch {
      toast.error(language === 'en' ? 'Failed to confirm room alerts' : 'Gagal mengonfirmasi peringatan ruangan');
    } finally {
      setAcknowledgingRoom(null);
    }
  }, [acknowledgeRoom, setAcknowledgingRoom, roomsData, fetchRoomPage, language]);

  const roomMap = useMemo(() => {
    const map = {};
    for (const r of rooms) map[r.id] = r.name;
    return map;
  }, [rooms]);

  const orderedRooms = useMemo(() => {
    const entries = Object.entries(roomsData);
    const summaryMap = {};
    for (const s of roomSummaries) summaryMap[s.room_id] = s;
    entries.sort((a, b) => {
      const sa = summaryMap[a[0]]?.total_alerts ?? a[1].total;
      const sb = summaryMap[b[0]]?.total_alerts ?? b[1].total;
      return sb - sa;
    });
    return entries;
  }, [roomsData, roomSummaries]);

  const locale = language === 'en' ? 'en-US' : 'id-ID';

  const toggleSelectAll = useCallback((roomAlerts) => {
    const newSelected = new Set(selectedAlerts);
    const allSelected = roomAlerts.every((a) => newSelected.has(a.id));
    if (allSelected) {
      roomAlerts.forEach((a) => newSelected.delete(a.id));
    } else {
      roomAlerts.forEach((a) => newSelected.add(a.id));
    }
    setSelectedAlerts(newSelected);
  }, [selectedAlerts]);

  const toggleSelectOne = useCallback((alertId) => {
    const newSelected = new Set(selectedAlerts);
    if (newSelected.has(alertId)) newSelected.delete(alertId);
    else newSelected.add(alertId);
    setSelectedAlerts(newSelected);
  }, [selectedAlerts]);

  const getBorderLeftColor = (severity, isAck) => {
    if (!isAck && (severity === 'critical' || severity === 'high')) return 'var(--ifrit-fire)';
    if (!isAck && (severity === 'medium' || severity === 'warning')) return 'var(--ifrit-warning)';
    return 'var(--ifrit-border)';
  };

  const getRowBgColor = (severity, isAck) => {
    if (!isAck && (severity === 'critical' || severity === 'high')) return 'rgba(248, 113, 113, 0.08)';
    return 'transparent';
  };

  const formatTimestamp = (dateStr) => {
    return new Date(dateStr).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatTimestampShort = (dateStr) => {
    return new Date(dateStr).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const parseSensorData = (message) => {
    if (!message || !message.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(message);
      return parsed.sensors || parsed.sensor_snapshot || null;
    } catch { return null; }
  };

  const renderPagination = (roomId, roomData) => {
    const maxPage = Math.max(1, Math.ceil(roomData.total / (roomData.pageSize || PER_PAGE)));
    if (roomData.total <= (roomData.pageSize || PER_PAGE)) return null;
    return (
      <div className="flex items-center justify-between p-3 rounded-b-lg border-t" key={`pg-${roomId}`} style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
        <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
          {language === 'en'
            ? `Page ${roomData.page} of ${maxPage} (${roomData.total} alerts)`
            : `Halaman ${roomData.page} dari ${maxPage} (${roomData.total} peringatan)`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRoomPageChange(roomId, roomData.page - 1, maxPage)}
            disabled={roomData.page <= 1 || roomData.isLoading}
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded border transition-all duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            <ChevronLeft className="w-3.5 h-3.5" /> {language === 'en' ? 'Prev' : 'Sblm'}
          </button>
          <button
            onClick={() => handleRoomPageChange(roomId, roomData.page + 1, maxPage)}
            disabled={roomData.page >= maxPage || roomData.isLoading}
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded border transition-all duration-150 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            {language === 'en' ? 'Next' : 'Brkt'} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const globalTotal = useMemo(() => roomSummaries.reduce((s, r) => s + r.total_alerts, 0), [roomSummaries]);

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      <AnimatePresence>
        {detailAlert && (() => {
          const imageUrl = detailAlert.image_url || detailAlert.snapshot_url;
          const roomName = roomMap[detailAlert.room_id] || detailAlert.room_id || '-';
          const sensorData = parseSensorData(detailAlert.message);

          return (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDetailAlert(null)}
            >
              <motion.div
                className="relative w-full max-w-2xl rounded-lg border shadow-2xl overflow-y-auto max-h-[90vh]"
                style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
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
                      <img src={imageUrl} alt={language === 'en' ? 'Detection image' : 'Gambar deteksi'} className="w-full object-cover max-h-80" />
                    </div>
                  )}

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

                  {sensorData && (
                    <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
                        {language === 'en' ? 'Sensor Readings' : 'Data Sensor'}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {sensorData.temperature !== undefined && (
                          <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
                            <Thermometer className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ifrit-warning)' }} />
                            <div>
                              <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ifrit-text-muted)' }}>Temp</div>
                              <div className="text-sm font-mono font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                                {sensorData.temperature}°C
                              </div>
                            </div>
                          </div>
                        )}
                        {sensorData.humidity !== undefined && (
                          <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
                            <Droplets className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ifrit-brand)' }} />
                            <div>
                              <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ifrit-text-muted)' }}>Humid</div>
                              <div className="text-sm font-mono font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                                {sensorData.humidity}%
                              </div>
                            </div>
                          </div>
                        )}
                        {sensorData.gas_level !== undefined && (
                          <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
                            <Gauge className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ifrit-fire)' }} />
                            <div>
                              <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ifrit-text-muted)' }}>Gas</div>
                              <div className="text-sm font-mono font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                                {sensorData.gas_level} ppm
                              </div>
                            </div>
                          </div>
                        )}
                        {sensorData.flame_detected !== undefined && (
                          <div className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
                            <Flame className="w-4 h-4 flex-shrink-0" style={{ color: sensorData.flame_detected ? 'var(--ifrit-fire)' : 'var(--ifrit-safe)' }} />
                            <div>
                              <div className="text-[10px] uppercase font-semibold" style={{ color: 'var(--ifrit-text-muted)' }}>Flame</div>
                              <div className="text-sm font-mono font-bold" style={{ color: sensorData.flame_detected ? 'var(--ifrit-fire)' : 'var(--ifrit-safe)' }}>
                                {sensorData.flame_detected
                                  ? (language === 'en' ? 'DETECTED' : 'TERDETEKSI')
                                  : (language === 'en' ? 'CLEAR' : 'AMAN')}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {!detailAlert.is_acknowledged && (
                    <div className="pt-4 border-t" style={{ borderColor: 'var(--ifrit-border)' }}>
                      <button
                        onClick={(e) => {
                          handleAcknowledge(e, detailAlert.id, detailAlert.room_id);
                          setDetailAlert(null);
                        }}
                        disabled={acknowledgingId === detailAlert.id}
                        className="inline-flex items-center justify-center gap-3 text-sm font-semibold px-4 py-2.5 min-h-[44px] rounded-md w-full transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[var(--ifrit-bg-tertiary)]"
                        style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                      >
                        {acknowledgingId === detailAlert.id ? (
                          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {language === 'en' ? 'Confirm Safe' : 'Konfirmasi Aman'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Header */}
      <div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ifrit-text-primary)' }}>
            {language === 'en' ? 'Fire Warning & Alerts History' : 'Notifikasi Peringatan Kebakaran'}
          </h1>
          <HoverClue text={language === 'en' ? 'Alert feed grouped by room with independent pagination. Filter by severity, room, or status. Click any row for full detail with sensor data.' : 'Umpan peringatan per ruangan dengan paginasi mandiri. Filter berdasarkan tingkat bahaya, ruangan, atau status. Klik untuk detail lengkap + data sensor.'} />
        </div>
        <p className="text-sm mt-4 font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
          {language === 'en' ? 'Default filter shows unacknowledged alerts. Switch "Status" to view all history.' : 'Filter default menampilkan peringatan yang belum dikonfirmasi. Ubah "Status" untuk lihat semua riwayat.'}
          <span className="ml-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-secondary)', border: '1px solid var(--ifrit-border)' }}>
            {globalTotal} {language === 'en' ? 'total' : 'total'}
          </span>
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <div className="w-full sm:w-48">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Severity' : 'Tingkat Bahaya'}
          </label>
          <select
            value={severityFilter}
            onChange={(e) => handleFilterChange('severity', e.target.value)}
            className="w-full appearance-none rounded-md border py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] cursor-pointer transition-shadow"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            <option value="all">{t['all_severities']}</option>
            <option value="critical">{language === 'en' ? 'Very Critical' : 'Sangat Kritis'}</option>
            <option value="high">{language === 'en' ? 'High' : 'Tinggi'}</option>
            <option value="medium">{language === 'en' ? 'Medium' : 'Sedang'}</option>
            <option value="low">{language === 'en' ? 'Low' : 'Rendah'}</option>
          </select>
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Room' : 'Ruangan'}
          </label>
          <select
            value={roomFilter}
            onChange={(e) => handleFilterChange('room', e.target.value)}
            className="w-full appearance-none rounded-md border py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] cursor-pointer transition-shadow"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            <option value="all">{t['all_rooms']}</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-48">
          <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Status' : 'Status'}
          </label>
          <select
            value={ackFilter}
            onChange={(e) => handleFilterChange('ack', e.target.value)}
            className="w-full appearance-none rounded-md border py-2 pl-3 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)] cursor-pointer transition-shadow"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}
          >
            <option value="active">{language === 'en' ? 'Unacknowledged' : 'Belum Dikonfirmasi'}</option>
            <option value="all">{language === 'en' ? 'All Statuses' : 'Semua Status'}</option>
            <option value="acknowledged">{language === 'en' ? 'Acknowledged' : 'Sudah Dikonfirmasi'}</option>
          </select>
        </div>
      </div>

      {/* Active Room Filter Banner */}
      {roomFilter !== 'all' && (
        <div className="flex items-center justify-between p-3 rounded-lg border" style={{ backgroundColor: 'var(--ifrit-brand)', borderColor: 'var(--ifrit-brand)', color: 'white' }}>
          <span className="text-sm font-semibold">
            {language === 'en' ? 'Filtering: ' : 'Filter: '}
            {roomMap[roomFilter] || roomFilter}
          </span>
          <button
            onClick={() => handleFilterChange('room', 'all')}
            className="inline-flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded hover:bg-white/10 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <X className="w-4 h-4" />
            {language === 'en' ? 'Clear' : 'Hapus'}
          </button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedAlerts.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border" style={{ backgroundColor: 'var(--ifrit-brand)', borderColor: 'var(--ifrit-brand)', color: 'white' }}>
          <div className="flex items-center gap-4">
            <CheckSquare className="w-5 h-5" />
            <span className="font-semibold text-sm">
              {selectedAlerts.size} {language === 'en' ? 'alerts selected' : 'peringatan dipilih'}
            </span>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => setSelectedAlerts(new Set())}
              disabled={isBulkAcknowledging}
              className="flex-1 sm:flex-none text-sm font-medium px-4 py-2 rounded hover:bg-white/10 transition-colors duration-150 disabled:opacity-50"
            >
              {language === 'en' ? 'Cancel' : 'Batal'}
            </button>
            <button
              onClick={handleBulkAcknowledge}
              disabled={isBulkAcknowledging}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 text-sm font-semibold px-4 py-2 rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50"
              style={{ backgroundColor: 'white', color: 'var(--ifrit-brand)' }}
            >
              {isBulkAcknowledging ? (
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'var(--ifrit-brand)', borderTopColor: 'transparent' }} />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              {language === 'en' ? 'Confirm Selected Safe' : 'Konfirmasi Terpilih Aman'}
            </button>
          </div>
        </div>
      )}

      {/* Loading Spinner */}
      {globalLoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)', borderWidth: '3px' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Loading alerts...' : 'Memuat peringatan...'}
          </span>
        </div>
      )}

      {/* Per-Room Content */}
      {!globalLoading && orderedRooms.length > 0 && (
        <div className="space-y-6">
          {orderedRooms.map(([roomId, roomData]) => {
            const roomName = roomMap[roomId] || roomId || (language === 'en' ? 'Unknown Room' : 'Ruangan Tidak Diketahui');
            const summary = roomSummaries.find((s) => s.room_id === roomId);
            const realTotal = summary?.total_alerts ?? roomData.total;
            const realUnack = summary?.unacknowledged_count ?? 0;
            const hasUnacknowledged = realUnack > 0;
            const alerts = roomData.alerts || [];
            const allSelected = alerts.length > 0 && alerts.every((a) => selectedAlerts.has(a.id));

            return (
              <div key={roomId} className="rounded-lg border overflow-hidden shadow-sm" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
                {/* Room Group Header */}
                <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => toggleSelectAll(alerts)}
                      className="p-2 -ml-2 rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors duration-150"
                      aria-label={language === 'en' ? 'Select all in room' : 'Pilih semua di ruangan'}
                    >
                      {allSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>
                    <span className="font-semibold text-sm" style={{ color: 'var(--ifrit-brand)' }}>{roomName}</span>
                    <span className="text-xs px-3 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', color: 'var(--ifrit-text-muted)', border: '1px solid var(--ifrit-border)' }}>
                      {realTotal} {language === 'en' ? 'alerts' : 'peringatan'}
                    </span>
                    {realUnack > 0 && (
                      <span className="text-xs px-3 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', color: 'var(--ifrit-warning)', border: '1px solid var(--ifrit-warning)' }}>
                        {realUnack} {language === 'en' ? 'unacknowledged' : 'belum'}
                      </span>
                    )}
                  </div>
                  {hasUnacknowledged && (
                    <button
                      onClick={() => handleAcknowledgeRoom(roomId, roomName)}
                      disabled={isAcknowledgingRoom === roomId}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                    >
                      {isAcknowledgingRoom === roomId ? (
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-pulse" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {language === 'en' ? 'Acknowledge All in Room' : 'Konfirmasi Semua'}
                    </button>
                  )}
                </div>

                {/* Room Loading */}
                {roomData.isLoading && (
                  <div className="p-8 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)' }} />
                  </div>
                )}

                {/* Room Alerts — Mobile (sm:hidden) */}
                {!roomData.isLoading && (
                  <div className="sm:hidden divide-y" style={{ borderColor: 'var(--ifrit-border)' }}>
                    {alerts.length === 0 ? (
                      <div className="p-8 text-center text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>
                        {language === 'en' ? 'No alerts on this page.' : 'Tidak ada peringatan.'}
                      </div>
                    ) : (
                      alerts.map((alert) => {
                        const imageUrl = alert.image_url || alert.snapshot_url;
                        return (
                          <div
                            key={alert.id}
                            onClick={() => setDetailAlert(alert)}
                            className="p-4 cursor-pointer relative transition-colors hover:bg-white/5"
                            style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: getBorderLeftColor(alert.severity, alert.is_acknowledged), backgroundColor: getRowBgColor(alert.severity, alert.is_acknowledged) }}
                          >
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <button
                                  role="checkbox"
                                  aria-checked={selectedAlerts.has(alert.id)}
                                  onClick={(e) => { e.stopPropagation(); toggleSelectOne(alert.id); }}
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10"
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
                                  className="w-14 h-14 rounded overflow-hidden border flex-shrink-0 hover:opacity-80"
                                  style={{ borderColor: 'var(--ifrit-border)' }}
                                >
                                  <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                </button>
                              )}
                            </div>
                            <div className="pl-11">
                              <div className="text-sm font-medium leading-snug mb-1" style={{ color: 'var(--ifrit-text-primary)' }}>
                                {getLocalizedMessage(alert.message, language)}
                              </div>
                              {getLocalizedExplanation(alert.message, language) && (
                                <div className="text-xs italic leading-relaxed mb-3" style={{ color: 'var(--ifrit-text-muted)' }}>
                                  {getLocalizedExplanation(alert.message, language)}
                                </div>
                              )}
                              {alert.is_acknowledged ? (
                                <span className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-md w-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--ifrit-safe)' }}>
                                  <CheckCircle2 className="w-4 h-4" /> {language === 'en' ? 'Confirmed Safe' : 'Sudah Aman'}
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => handleAcknowledge(e, alert.id, alert.room_id)}
                                  disabled={acknowledgingId === alert.id}
                                  className="inline-flex items-center justify-center gap-3 text-sm font-semibold px-4 py-2 min-h-[44px] rounded-md w-full transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50"
                                  style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                                >
                                  {acknowledgingId === alert.id ? (
                                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                  )}
                                  {t['confirm_now'] || 'Confirm'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Room Alerts — Desktop Table */}
                {!roomData.isLoading && (
                  <div className="hidden sm:block">
                    {alerts.length === 0 ? (
                      <div className="p-8 text-center text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>
                        {language === 'en' ? 'No alerts on this page.' : 'Tidak ada peringatan.'}
                      </div>
                    ) : (
                      <Table>
                        <TableBody>
                          {alerts.map((alert) => {
                            const imageUrl = alert.image_url || alert.snapshot_url;
                            return (
                              <TableRow
                                key={alert.id}
                                onClick={() => setDetailAlert(alert)}
                                className="transition-colors hover:bg-white/5 cursor-pointer"
                                style={{ borderColor: 'var(--ifrit-border)', borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: getBorderLeftColor(alert.severity, alert.is_acknowledged), backgroundColor: getRowBgColor(alert.severity, alert.is_acknowledged) }}
                              >
                                <TableCell className="w-12 align-middle">
                                  <button
                                    role="checkbox"
                                    aria-checked={selectedAlerts.has(alert.id)}
                                    onClick={(e) => { e.stopPropagation(); toggleSelectOne(alert.id); }}
                                    className="p-1.5 rounded text-[var(--ifrit-text-muted)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/10 transition-colors"
                                  >
                                    {selectedAlerts.has(alert.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                  </button>
                                </TableCell>
                                <TableCell className="w-20 align-middle">
                                  {imageUrl ? (
                                    <button onClick={(e) => { e.stopPropagation(); window.open(imageUrl, '_blank'); }} className="w-16 h-10 rounded overflow-hidden border hover:opacity-80" style={{ borderColor: 'var(--ifrit-border)' }}>
                                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  ) : (
                                    <div className="w-16 h-10 rounded flex items-center justify-center border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                                      <ImageIcon className="w-4 h-4 opacity-40" style={{ color: 'var(--ifrit-text-muted)' }} />
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="w-44 align-middle font-mono text-sm whitespace-nowrap tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>
                                  {formatTimestamp(alert.created_at)}
                                </TableCell>
                                <TableCell className="w-28 align-middle">
                                  <StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                                </TableCell>
                                <TableCell className="align-middle max-w-[350px]">
                                  <div className="text-sm font-medium leading-snug" style={{ color: 'var(--ifrit-text-primary)' }}>
                                    {getLocalizedMessage(alert.message, language)}
                                  </div>
                                  {getLocalizedExplanation(alert.message, language) && (
                                    <div className="text-xs mt-1 italic leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>
                                      {getLocalizedExplanation(alert.message, language)}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="w-36 align-middle text-right">
                                  {alert.is_acknowledged ? (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--ifrit-safe)' }}>
                                      <CheckCircle2 className="w-3.5 h-3.5" /> {language === 'en' ? 'Safe' : 'Aman'}
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => handleAcknowledge(e, alert.id, alert.room_id)}
                                      disabled={acknowledgingId === alert.id}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all duration-150 hover:opacity-90 active:scale-[0.98] motion-reduce:scale-100 shadow-sm disabled:opacity-50"
                                      style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}
                                    >
                                      {acknowledgingId === alert.id ? (
                                        <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                      ) : (
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      )}
                                      {t['confirm_now'] || 'Confirm'}
                                    </button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}

                {/* Per-Room Pagination */}
                {renderPagination(roomId, roomData)}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!globalLoading && orderedRooms.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 border rounded-lg" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
          <ShieldCheck className="w-10 h-10 opacity-40" style={{ color: 'var(--ifrit-safe)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
            {language === 'en' ? 'No alerts match your filters' : 'Tidak ada peringatan yang cocok'}
          </span>
          <span className="text-xs text-center px-4" style={{ color: 'var(--ifrit-text-muted)' }}>
            {language === 'en' ? 'Try adjusting the severity, room, or status filters.' : 'Coba sesuaikan filter tingkat bahaya, ruangan, atau status.'}
          </span>
        </div>
      )}
    </div>
  );
}
