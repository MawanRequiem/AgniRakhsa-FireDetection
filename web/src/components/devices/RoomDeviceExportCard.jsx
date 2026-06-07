import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Calendar, Database, Loader2, Info, AlertCircle, Check } from 'lucide-react';
import { customFetch } from '@/lib/api';

export default function RoomDeviceExportCard({ roomId, devices }) {
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [preset, setPreset] = useState('24h');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      let queryParams = new URLSearchParams();
      queryParams.append('preset', preset);

      if (selectedDevice === 'all') {
        if (roomId) queryParams.append('room_id', roomId);
      } else {
        queryParams.append('device_id', selectedDevice);
      }

      if (preset === 'custom') {
        if (!startTime || !endTime) {
          throw new Error('Silakan pilih tanggal dan waktu mulai serta selesai untuk ekspor kustom.');
        }
        
        // Convert to ISO string in UTC or exact local
        const startISO = new Date(startTime).toISOString();
        const endISO = new Date(endTime).toISOString();

        if (new Date(startTime) > new Date(endTime)) {
          throw new Error('Tanggal/waktu mulai tidak boleh melebihi tanggal/waktu selesai.');
        }

        queryParams.append('start_time', startISO);
        queryParams.append('end_time', endISO);
      }

      const res = await customFetch(`/api/v1/sensors/export?${queryParams.toString()}`);
      
      if (!res.ok) {
        let errMsg = 'Gagal membuat file ekspor data.';
        try {
          const errData = await res.json();
          errMsg = errData.detail || errMsg;
        } catch (_) {}
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Extract filename from headers
      const disposition = res.headers.get('content-disposition');
      let filename = `laporan_sensor_${preset}_ekspor.csv`;
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.message || 'Terjadi kesalahan saat mengekspor data.');
    } finally {
      setIsLoading(false);
    }
  };

  const presets = [
    { value: '1h', label: '1 Jam' },
    { value: '6h', label: '6 Jam' },
    { value: '24h', label: '24 Jam' },
    { value: '7d', label: '7 Hari' },
    { value: '30d', label: '30 Hari' },
    { value: 'custom', label: 'Kustom' },
  ];

  return (
    <div className="border rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
      {/* Title */}
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
        <Database className="w-4 h-4 text-[var(--ifrit-brand)]" />
        <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Ekspor & Unduh Data Gas</h3>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--ifrit-text-secondary)' }}>
        Unduh riwayat data hambatan sensor MQ dan parameter lingkungan per menit ke dalam format tabel spreadsheet (CSV) yang rapi.
      </p>

      {/* Target Node Selector */}
      {devices && devices.length > 0 && (
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ifrit-text-muted)' }}>
            Target Perangkat IoT
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full h-9 rounded-lg border text-xs px-2.5 outline-none font-medium cursor-pointer transition-colors shadow-sm"
            style={{ 
              backgroundColor: 'var(--ifrit-bg-secondary)', 
              borderColor: 'var(--ifrit-border)',
              color: 'var(--ifrit-text-primary)'
            }}
          >
            <option value="all">Semua Perangkat (Total Ruangan)</option>
            {devices.map(dev => (
              <option key={dev.id} value={dev.id}>{dev.name} ({dev.mac_address || '-'})</option>
            ))}
          </select>
        </div>
      )}

      {/* Preset Picker */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--ifrit-text-muted)' }}>
          Rentang Waktu
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setPreset(p.value);
                setError(null);
              }}
              className="text-[10px] py-1.5 px-2 font-bold rounded-lg border cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: preset === p.value ? 'var(--ifrit-bg-tertiary)' : 'var(--ifrit-bg-secondary)',
                borderColor: preset === p.value ? 'var(--ifrit-brand)' : 'var(--ifrit-border)',
                color: preset === p.value ? 'var(--ifrit-text-primary)' : 'var(--ifrit-text-secondary)',
                boxShadow: preset === p.value ? '0 0 4px rgba(239, 68, 68, 0.15)' : 'none'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Picker Block */}
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border text-xs animate-fadeIn" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
          <div className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-80" style={{ color: 'var(--ifrit-text-muted)' }}>Waktu Mulai</span>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setError(null);
              }}
              className="w-full bg-transparent border-0 outline-none text-xs p-1 font-mono rounded cursor-pointer"
              style={{ color: 'var(--ifrit-text-primary)' }}
            />
          </div>
          <div className="space-y-1 border-l pl-2" style={{ borderColor: 'var(--ifrit-border)' }}>
            <span className="text-[9px] font-bold uppercase tracking-wider opacity-80" style={{ color: 'var(--ifrit-text-muted)' }}>Waktu Selesai</span>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setError(null);
              }}
              className="w-full bg-transparent border-0 outline-none text-xs p-1 font-mono rounded cursor-pointer"
              style={{ color: 'var(--ifrit-text-primary)' }}
            />
          </div>
        </div>
      )}

      {/* Info Warning */}
      {preset === '30d' && (
        <div className="flex gap-2 p-2.5 rounded-lg border text-[10px] leading-relaxed" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}>
          <Info className="w-4 h-4 text-[var(--ifrit-brand)] shrink-0 mt-0.5" />
          <span>Kumpulan data besar mungkin memerlukan waktu hingga 10 detik untuk diproses di latar belakang.</span>
        </div>
      )}

      {/* Status Messages */}
      {error && (
        <div className="flex items-center gap-1.5 text-red-400 p-2.5 rounded border border-red-500/20 bg-red-500/10 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-1.5 text-emerald-400 p-2.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-[11px]">
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>Ekspor data berhasil dibuat dan unduhan dimulai!</span>
        </div>
      )}

      {/* Download Action Button */}
      <Button
        onClick={handleExport}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-1.5 text-xs font-bold h-9 text-white cursor-pointer transition-colors shadow-sm"
        style={{ backgroundColor: 'var(--ifrit-brand)', hover: { backgroundColor: 'var(--ifrit-brand-hover)' } }}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Memproses Data...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor Tabel Data</span>
          </>
        )}
      </Button>
    </div>
  );
}
