import { useState, useEffect, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import StatusIndicator from '@/components/ui/StatusIndicator';
import HoverClue from '@/components/ui/HoverClue';
import { motion, AnimatePresence } from 'framer-motion';
import { useAlertsStore } from '@/stores/useAlertsStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { useUIStore } from '@/store/store';
import { CheckCircle2, ShieldCheck, Image as ImageIcon, CheckSquare, Square, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, X, Thermometer, Droplets, Flame, Gauge } from 'lucide-react';
import { toast } from 'sonner';
import { translations, getLocalizedMessage, getLocalizedExplanation } from '@/lib/translations';

const PER_PAGE = 5;

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
  const [collapsedRooms, setCollapsedRooms] = useState(new Set());

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

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

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

  useEffect(() => {
    if (!detailAlert) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
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

  const toggleRoomCollapse = useCallback((roomId) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  }, []);

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
          if (data.alerts.find((a) => a.id === alertId)) {
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
        const current = roomsData[roomId];
        if (current) fetchRoomPage(roomId, current.page);
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
    const sm = {};
    for (const s of roomSummaries) sm[s.room_id] = s;
    entries.sort((a, b) => {
      const sa = sm[a[0]]?.total_alerts ?? a[1].total;
      const sb = sm[b[0]]?.total_alerts ?? b[1].total;
      return sb - sa;
    });
    return entries;
  }, [roomsData, roomSummaries]);

  const locale = language === 'en' ? 'en-US' : 'id-ID';

  const toggleSelectAll = useCallback((roomAlerts) => {
    const ns = new Set(selectedAlerts);
    const all = roomAlerts.every((a) => ns.has(a.id));
    if (all) roomAlerts.forEach((a) => ns.delete(a.id));
    else roomAlerts.forEach((a) => ns.add(a.id));
    setSelectedAlerts(ns);
  }, [selectedAlerts]);

  const toggleSelectOne = useCallback((alertId) => {
    const ns = new Set(selectedAlerts);
    if (ns.has(alertId)) ns.delete(alertId);
    else ns.add(alertId);
    setSelectedAlerts(ns);
  }, [selectedAlerts]);

  const getBorderColor = (sev, ack) => {
    if (!ack && (sev === 'critical' || sev === 'high')) return 'var(--ifrit-fire)';
    if (!ack && (sev === 'medium' || sev === 'warning')) return 'var(--ifrit-warning)';
    return 'var(--ifrit-border)';
  };

  const getRowBg = (sev, ack) => {
    if (!ack && (sev === 'critical' || sev === 'high')) return 'rgba(248, 113, 113, 0.08)';
    return 'transparent';
  };

  const fmt = (d) => new Date(d).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtShort = (d) => new Date(d).toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const parseSensorData = (msg) => {
    if (!msg || !msg.startsWith('{')) return null;
    try { return JSON.parse(msg).sensors || JSON.parse(msg).sensor_snapshot || null; }
    catch { return null; }
  };

  const renderPagination = (roomId, roomData) => {
    const maxPage = Math.max(1, Math.ceil(roomData.total / (roomData.pageSize || PER_PAGE)));
    if (roomData.total <= (roomData.pageSize || PER_PAGE)) return null;
    return (
      <div className="flex items-center justify-between p-3 border-t" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
        <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
          {language === 'en'
            ? `Page ${roomData.page} of ${maxPage} (${roomData.total} alerts)`
            : `Halaman ${roomData.page} dari ${maxPage} (${roomData.total} peringatan)`}
        </span>
        <div className="flex gap-2">
          <button onClick={() => handleRoomPageChange(roomId, roomData.page - 1, maxPage)} disabled={roomData.page <= 1 || roomData.isLoading}
            className="text-xs font-medium px-3 py-1.5 rounded border hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
            <ChevronLeft className="w-3.5 h-3.5 inline" /> {language === 'en' ? 'Prev' : 'Sblm'}
          </button>
          <button onClick={() => handleRoomPageChange(roomId, roomData.page + 1, maxPage)} disabled={roomData.page >= maxPage || roomData.isLoading}
            className="text-xs font-medium px-3 py-1.5 rounded border hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
            {language === 'en' ? 'Next' : 'Brkt'} <ChevronRight className="w-3.5 h-3.5 inline" />
          </button>
        </div>
      </div>
    );
  };

  const globalTotal = useMemo(() => roomSummaries.reduce((s, r) => s + r.total_alerts, 0), [roomSummaries]);

  return (
    <div className="space-y-6">
      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {detailAlert && (() => {
          const img = detailAlert.image_url || detailAlert.snapshot_url;
          const roomName = roomMap[detailAlert.room_id] || detailAlert.room_id || '-';
          const sd = parseSensorData(detailAlert.message);

          return (
            <motion.div
              className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
              style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setDetailAlert(null)}
            >
              <motion.div
                className="relative w-full my-8 max-w-3xl rounded-xl border shadow-2xl"
                style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10 rounded-t-xl"
                  style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
                  <div className="flex items-center gap-3">
                    <StatusIndicator status={detailAlert.severity === 'critical' ? 'fire' : detailAlert.severity === 'high' ? 'warning' : 'info'} size="md" />
                    <div>
                      <span className="font-bold text-base block" style={{ color: 'var(--ifrit-text-primary)' }}>
                        {getLocalizedMessage(detailAlert.message, language)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
                        {roomName} · {fmt(detailAlert.created_at)}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setDetailAlert(null)}
                    className="p-2 rounded hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ifrit-brand)]"
                    aria-label={language === 'en' ? 'Close' : 'Tutup'}>
                    <X className="w-5 h-5" style={{ color: 'var(--ifrit-text-muted)' }} />
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {/* Image */}
                  {img && (
                    <div className="rounded-xl overflow-hidden border shadow-sm" style={{ borderColor: 'var(--ifrit-border)' }}>
                      <img src={img} alt="" className="w-full object-cover max-h-96" />
                    </div>
                  )}

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl border"
                    style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                    <Meta label="Risk Level" labelId="Tingkat Bahaya" lang={language}>
                      <StatusIndicator status={detailAlert.severity === 'critical' ? 'fire' : detailAlert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                    </Meta>
                    <Meta label="Room" labelId="Ruangan" lang={language} value={roomName} />
                    <Meta label="Detection Time" labelId="Waktu Deteksi" lang={language} value={fmt(detailAlert.created_at)} mono />
                    <Meta label="Status" labelId="Status" lang={language}>
                      <span style={{ color: detailAlert.is_acknowledged ? 'var(--ifrit-safe)' : 'var(--ifrit-warning)' }}>
                        {detailAlert.is_acknowledged ? (language === 'en' ? 'Confirmed Safe' : 'Sudah Aman') : (language === 'en' ? 'Unacknowledged' : 'Belum Dikonfirmasi')}
                      </span>
                    </Meta>
                    <Meta label="Severity" labelId="Severitas" lang={language} value={detailAlert.severity?.toUpperCase()} />
                    {detailAlert.acknowledged_at && (
                      <Meta label="Acknowledged At" labelId="Dikonfirmasi Pada" lang={language} value={fmt(detailAlert.acknowledged_at)} mono />
                    )}
                  </div>

                  {/* Explanation */}
                  {getLocalizedExplanation(detailAlert.message, language) && (
                    <div className="p-4 rounded-xl border italic text-sm leading-relaxed"
                      style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-muted)' }}>
                      {getLocalizedExplanation(detailAlert.message, language)}
                    </div>
                  )}

                  {/* Sensor panel */}
                  {sd && (
                    <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--ifrit-text-muted)' }}>
                        {language === 'en' ? 'Sensor Readings' : 'Data Sensor'}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {sd.temperature !== undefined && <SensorBadge icon={Thermometer} color="var(--ifrit-warning)" label="Temp" value={`${sd.temperature}°C`} />}
                        {sd.humidity !== undefined && <SensorBadge icon={Droplets} color="var(--ifrit-brand)" label="Humid" value={`${sd.humidity}%`} />}
                        {sd.gas_level !== undefined && <SensorBadge icon={Gauge} color="var(--ifrit-fire)" label="Gas" value={`${sd.gas_level} ppm`} />}
                        {sd.flame_detected !== undefined && (
                          <SensorBadge icon={Flame} color={sd.flame_detected ? 'var(--ifrit-fire)' : 'var(--ifrit-safe)'}
                            label="Flame" value={sd.flame_detected ? (language === 'en' ? 'DETECTED' : 'TERDETEKSI') : (language === 'en' ? 'CLEAR' : 'AMAN')} />
                        )}
                      </div>
                    </div>
                  )}

                  {/* ACK button */}
                  {!detailAlert.is_acknowledged && (
                    <button onClick={(e) => { handleAcknowledge(e, detailAlert.id, detailAlert.room_id); setDetailAlert(null); }}
                      disabled={acknowledgingId === detailAlert.id}
                      className="w-full flex items-center justify-center gap-3 font-bold text-sm px-4 py-3 rounded-xl transition-all hover:opacity-90 active:scale-[0.98] shadow-lg disabled:opacity-50"
                      style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}>
                      {acknowledgingId === detailAlert.id ? (
                        <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                      ) : <CheckCircle2 className="w-5 h-5" />}
                      {language === 'en' ? 'Confirm Safe' : 'Konfirmasi Aman'}
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Header ── */}
      <div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
            {language === 'en' ? 'Fire Warning & Alerts History' : 'Notifikasi Peringatan Kebakaran'}
          </h1>
          <HoverClue text={language === 'en' ? 'Grouped by room. Click header to collapse/expand. 5 alerts per page per room.' : 'Dikelompokkan per ruangan. Klik header untuk collapse/expand. 5 alert per halaman.'} />
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--ifrit-text-muted)' }}>
          {language === 'en' ? 'Default: unacknowledged only. Change Status filter to see all.' : 'Default: hanya yang belum dikonfirmasi. Ubah filter Status untuk lihat semua.'}
          <span className="ml-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-secondary)', border: '1px solid var(--ifrit-border)' }}>
            {globalTotal} {language === 'en' ? 'total' : 'total'}
          </span>
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <select value={severityFilter} onChange={(e) => handleFilterChange('severity', e.target.value)}
          className="py-2.5 px-3 rounded-lg border text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
          <option value="all">{t['all_severities']}</option>
          <option value="critical">{language === 'en' ? 'Critical' : 'Kritis'}</option>
          <option value="high">{language === 'en' ? 'High' : 'Tinggi'}</option>
          <option value="medium">{language === 'en' ? 'Medium' : 'Sedang'}</option>
          <option value="low">{language === 'en' ? 'Low' : 'Rendah'}</option>
        </select>
        <select value={roomFilter} onChange={(e) => handleFilterChange('room', e.target.value)}
          className="py-2.5 px-3 rounded-lg border text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
          <option value="all">{t['all_rooms']}</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={ackFilter} onChange={(e) => handleFilterChange('ack', e.target.value)}
          className="py-2.5 px-3 rounded-lg border text-sm font-medium cursor-pointer"
          style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-primary)' }}>
          <option value="active">{language === 'en' ? 'Unacknowledged' : 'Belum Dikonfirmasi'}</option>
          <option value="all">{language === 'en' ? 'All Statuses' : 'Semua Status'}</option>
          <option value="acknowledged">{language === 'en' ? 'Acknowledged' : 'Sudah Dikonfirmasi'}</option>
        </select>
      </div>

      {/* ── Active Room Filter Banner ── */}
      {roomFilter !== 'all' && (
        <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: 'var(--ifrit-brand)', color: 'white' }}>
          <span className="text-sm font-semibold">{language === 'en' ? 'Filtering: ' : 'Filter: '}{roomMap[roomFilter] || roomFilter}</span>
          <button onClick={() => handleFilterChange('room', 'all')}
            className="text-sm font-medium px-3 py-1.5 rounded hover:bg-white/10"><X className="w-4 h-4 inline" /> {language === 'en' ? 'Clear' : 'Hapus'}</button>
        </div>
      )}

      {/* ── Bulk Action Bar ── */}
      {selectedAlerts.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl" style={{ backgroundColor: 'var(--ifrit-brand)', color: 'white' }}>
          <div className="flex items-center gap-3"><CheckSquare className="w-5 h-5" />
            <span className="font-semibold text-sm">{selectedAlerts.size} {language === 'en' ? 'selected' : 'dipilih'}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSelectedAlerts(new Set())} disabled={isBulkAcknowledging}
              className="text-sm font-medium px-4 py-2 rounded hover:bg-white/10 disabled:opacity-50">{language === 'en' ? 'Cancel' : 'Batal'}</button>
            <button onClick={handleBulkAcknowledge} disabled={isBulkAcknowledging}
              className="text-sm font-bold px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 shadow"
              style={{ backgroundColor: 'white', color: 'var(--ifrit-brand)' }}>
              {isBulkAcknowledging ? <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor: 'var(--ifrit-brand)', borderTopColor: 'transparent' }} />
                : <CheckCircle2 className="w-4 h-4 inline" />}
              {' '}{language === 'en' ? 'Confirm Safe' : 'Konfirmasi Aman'}
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {globalLoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-16">
          <div className="w-10 h-10 border-3 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)', borderWidth: '3px' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>{language === 'en' ? 'Loading alerts...' : 'Memuat peringatan...'}</span>
        </div>
      )}

      {/* ── Per-Room Content ── */}
      {!globalLoading && orderedRooms.length > 0 && (
        <div className="space-y-4">
          {orderedRooms.map(([roomId, roomData]) => {
            const roomName = roomMap[roomId] || roomId || (language === 'en' ? 'Unknown Room' : 'Ruangan Tidak Diketahui');
            const summary = roomSummaries.find((s) => s.room_id === roomId);
            const realTotal = summary?.total_alerts ?? roomData.total;
            const realUnack = summary?.unacknowledged_count ?? 0;
            const hasUnack = realUnack > 0;
            const alerts = roomData.alerts || [];
            const allSelected = alerts.length > 0 && alerts.every((a) => selectedAlerts.has(a.id));
            const isCollapsed = collapsedRooms.has(roomId);

            return (
              <div key={roomId} className="rounded-xl border overflow-hidden shadow-sm" style={{ borderColor: 'var(--ifrit-border)' }}>
                {/* Room Header — clickable to collapse */}
                <button
                  onClick={() => toggleRoomCollapse(roomId)}
                  className="w-full p-4 flex items-center justify-between gap-3 transition-colors hover:brightness-95 text-left"
                  style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                    <span className="font-bold text-sm" style={{ color: 'var(--ifrit-brand)' }}>{roomName}</span>
                    <span className="text-xs px-3 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', color: 'var(--ifrit-text-muted)', border: '1px solid var(--ifrit-border)' }}>
                      {realTotal} {language === 'en' ? 'alerts' : 'peringatan'}
                    </span>
                    {realUnack > 0 && (
                      <span className="text-xs px-3 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: 'rgba(234, 179, 8, 0.12)', color: 'var(--ifrit-warning)', border: '1px solid var(--ifrit-warning)' }}>
                        {realUnack} {language === 'en' ? 'unacknowledged' : 'belum'}
                      </span>
                    )}
                    {isCollapsed && (
                      <span className="text-xs font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
                        — {alerts.length} {language === 'en' ? 'showing' : 'terlihat'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {hasUnack && !isCollapsed && (
                      <button onClick={() => handleAcknowledgeRoom(roomId, roomName)}
                        disabled={isAcknowledgingRoom === roomId}
                        className="text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 shadow"
                        style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}>
                        {isAcknowledgingRoom === roomId ? (
                          <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin mx-2" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                        ) : (language === 'en' ? 'ACK All' : 'Konfirmasi Semua')}
                      </button>
                    )}
                    {isCollapsed ? <ChevronDown className="w-5 h-5" style={{ color: 'var(--ifrit-text-muted)' }} />
                      : <ChevronUp className="w-5 h-5" style={{ color: 'var(--ifrit-text-muted)' }} />}
                  </div>
                </button>

                {/* Collapsed: show nothing */}
                {!isCollapsed && (
                  <>
                    {/* Per-Room Pagination (top) */}
                    {roomData.total > (roomData.pageSize || PER_PAGE) && (
                      <div className="px-4 pt-3">
                        {renderPagination(roomId, roomData)}
                      </div>
                    )}

                    {roomData.isLoading && (
                      <div className="p-8 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)' }} />
                      </div>
                    )}

                    {/* Desktop Table View */}
                    {!roomData.isLoading && alerts.length > 0 && (
                      <div className="hidden sm:block">
                        <Table>
                          <TableHeader style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                            <TableRow style={{ borderColor: 'var(--ifrit-border)' }}>
                              <TableHead className="w-12"><span className="sr-only">Select</span></TableHead>
                              <TableHead className="w-20">{language === 'en' ? 'Preview' : 'Gambar'}</TableHead>
                              <TableHead className="w-44">{language === 'en' ? 'Detection Time' : 'Waktu'}</TableHead>
                              <TableHead className="w-28">{language === 'en' ? 'Risk' : 'Bahaya'}</TableHead>
                              <TableHead>{language === 'en' ? 'Event Message' : 'Pesan'}</TableHead>
                              <TableHead className="w-36 text-right">{t['actions']}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {alerts.map((alert) => {
                              const imgUrl = alert.image_url || alert.snapshot_url;
                              return (
                                <TableRow key={alert.id} onClick={() => setDetailAlert(alert)}
                                  className="transition-colors hover:bg-white/5 cursor-pointer"
                                  style={{ borderColor: 'var(--ifrit-border)', borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: getBorderColor(alert.severity, alert.is_acknowledged), backgroundColor: getRowBg(alert.severity, alert.is_acknowledged) }}>
                                  <TableCell>
                                    <button role="checkbox" aria-checked={selectedAlerts.has(alert.id)}
                                      onClick={(e) => { e.stopPropagation(); toggleSelectOne(alert.id); }}
                                      className="p-1.5 rounded hover:bg-white/10">
                                      {selectedAlerts.has(alert.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" style={{ color: 'var(--ifrit-text-muted)' }} />}
                                    </button>
                                  </TableCell>
                                  <TableCell>
                                    {imgUrl ? (
                                      <button onClick={(e) => { e.stopPropagation(); window.open(imgUrl, '_blank'); }}
                                        className="w-16 h-10 rounded overflow-hidden border hover:opacity-80" style={{ borderColor: 'var(--ifrit-border)' }}>
                                        <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                      </button>
                                    ) : (
                                      <div className="w-16 h-10 rounded flex items-center justify-center border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
                                        <ImageIcon className="w-4 h-4 opacity-40" style={{ color: 'var(--ifrit-text-muted)' }} />
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs whitespace-nowrap tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>{fmt(alert.created_at)}</TableCell>
                                  <TableCell><StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" /></TableCell>
                                  <TableCell className="max-w-[300px]">
                                    <div className="text-sm font-medium leading-snug" style={{ color: 'var(--ifrit-text-primary)' }}>{getLocalizedMessage(alert.message, language)}</div>
                                    {getLocalizedExplanation(alert.message, language) && (
                                      <div className="text-xs mt-1 italic leading-relaxed" style={{ color: 'var(--ifrit-text-muted)' }}>{getLocalizedExplanation(alert.message, language)}</div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {alert.is_acknowledged ? (
                                      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--ifrit-safe)' }}>
                                        <CheckCircle2 className="w-3.5 h-3.5" /> {language === 'en' ? 'Safe' : 'Aman'}
                                      </span>
                                    ) : (
                                      <button onClick={(e) => handleAcknowledge(e, alert.id, alert.room_id)} disabled={acknowledgingId === alert.id}
                                        className="text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow"
                                        style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}>
                                        {acknowledgingId === alert.id ? (
                                          <div className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin mx-1" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                        ) : <>{t['confirm_now'] || 'Confirm'}</>}
                                      </button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Mobile Card View */}
                    {!roomData.isLoading && alerts.length > 0 && (
                      <div className="sm:hidden divide-y" style={{ borderColor: 'var(--ifrit-border)' }}>
                        {alerts.map((alert) => {
                          const imgUrl = alert.image_url || alert.snapshot_url;
                          return (
                            <div key={alert.id} onClick={() => setDetailAlert(alert)}
                              className="p-4 cursor-pointer relative transition-colors hover:bg-white/5"
                              style={{ borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: getBorderColor(alert.severity, alert.is_acknowledged), backgroundColor: getRowBg(alert.severity, alert.is_acknowledged) }}>
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <button role="checkbox" aria-checked={selectedAlerts.has(alert.id)}
                                    onClick={(e) => { e.stopPropagation(); toggleSelectOne(alert.id); }}
                                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded hover:bg-white/10">
                                    {selectedAlerts.has(alert.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" style={{ color: 'var(--ifrit-text-muted)' }} />}
                                  </button>
                                  <StatusIndicator status={alert.severity === 'critical' ? 'fire' : alert.severity === 'high' ? 'warning' : 'info'} showLabel size="sm" />
                                  <span className="font-mono text-xs whitespace-nowrap tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>{fmtShort(alert.created_at)}</span>
                                </div>
                                {imgUrl && (
                                  <button onClick={(e) => { e.stopPropagation(); window.open(imgUrl, '_blank'); }}
                                    className="w-14 h-14 rounded overflow-hidden border flex-shrink-0 hover:opacity-80" style={{ borderColor: 'var(--ifrit-border)' }}>
                                    <img src={imgUrl} alt="" className="w-full h-full object-cover" />
                                  </button>
                                )}
                              </div>
                              <div className="pl-11">
                                <div className="text-sm font-medium leading-snug mb-1" style={{ color: 'var(--ifrit-text-primary)' }}>{getLocalizedMessage(alert.message, language)}</div>
                                {getLocalizedExplanation(alert.message, language) && (
                                  <div className="text-xs italic leading-relaxed mb-3" style={{ color: 'var(--ifrit-text-muted)' }}>{getLocalizedExplanation(alert.message, language)}</div>
                                )}
                                {alert.is_acknowledged ? (
                                  <span className="inline-flex items-center justify-center gap-2 text-sm font-medium px-4 py-2 rounded-lg w-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: 'var(--ifrit-safe)' }}>
                                    <CheckCircle2 className="w-4 h-4" /> {language === 'en' ? 'Confirmed Safe' : 'Sudah Aman'}
                                  </span>
                                ) : (
                                  <button onClick={(e) => handleAcknowledge(e, alert.id, alert.room_id)} disabled={acknowledgingId === alert.id}
                                    className="w-full flex items-center justify-center gap-3 text-sm font-bold px-4 py-2 min-h-[44px] rounded-lg hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow"
                                    style={{ backgroundColor: 'var(--ifrit-safe)', color: 'white' }}>
                                    {acknowledgingId === alert.id ? (
                                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                    ) : <CheckCircle2 className="w-4 h-4" />}
                                    {t['confirm_now'] || 'Confirm'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty page */}
                    {!roomData.isLoading && alerts.length === 0 && (
                      <div className="p-8 text-center text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>
                        {language === 'en' ? 'No alerts on this page.' : 'Tidak ada peringatan di halaman ini.'}
                      </div>
                    )}

                    {/* Per-Room Pagination (bottom) */}
                    {renderPagination(roomId, roomData)}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Empty State ── */}
      {!globalLoading && orderedRooms.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 border rounded-xl"
          style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
          <ShieldCheck className="w-12 h-12 opacity-40" style={{ color: 'var(--ifrit-safe)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>{language === 'en' ? 'No alerts match your filters' : 'Tidak ada peringatan yang cocok'}</span>
          <span className="text-xs text-center px-4" style={{ color: 'var(--ifrit-text-muted)' }}>{language === 'en' ? 'Try adjusting filters.' : 'Coba sesuaikan filter.'}</span>
        </div>
      )}
    </div>
  );
}

/* ── Helper components ── */

function Meta({ label, labelId, lang, value, mono, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>{lang === 'en' ? label : labelId}</div>
      {children || (mono ? <span className="font-mono text-sm tabular-nums" style={{ color: 'var(--ifrit-text-secondary)' }}>{value}</span>
        : <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>{value}</span>)}
    </div>
  );
}

function SensorBadge({ icon: Icon, color, label, value }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
      <Icon className="w-5 h-5 flex-shrink-0" style={{ color }} />
      <div>
        <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--ifrit-text-muted)' }}>{label}</div>
        <div className="text-sm font-mono font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}
