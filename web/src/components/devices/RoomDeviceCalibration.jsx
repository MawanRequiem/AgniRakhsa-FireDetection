import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Cpu, Check, AlertCircle, Loader2, Wifi, WifiOff, Clock } from 'lucide-react';
import { customFetch } from '@/lib/api';

function DeviceCalibrationItem({ device }) {
  const [calibration, setCalibration] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commandStatus, setCommandStatus] = useState('idle'); // idle, pending, in_progress
  const [error, setError] = useState(null);
  const [localDevice, setLocalDevice] = useState(device);
  const prevCommandStatusRef = useRef('idle');

  const fetchCalibration = async () => {
    try {
      const res = await customFetch(`/api/v1/calibration/${device.id}/latest`);
      if (res.ok) {
        const data = await res.json();
        setCalibration(data.calibrated === false ? null : data);
      }
    } catch (err) {
      console.error('Failed to fetch calibration baseline:', err);
    }
  };

  const fetchDeviceStatus = async () => {
    try {
      const res = await customFetch(`/api/v1/devices/${device.id}`);
      if (res.ok) {
        const data = await res.json();
        setLocalDevice(data);
      }
    } catch (err) {
      console.error('Failed to fetch device details:', err);
    }
  };

  const pollStatus = async () => {
    try {
      const [cmdRes, devRes] = await Promise.all([
        customFetch(`/api/v1/calibration/${device.id}/command-status`),
        customFetch(`/api/v1/devices/${device.id}`)
      ]);

      let newCmdStatus = 'idle';
      if (cmdRes.ok) {
        const cmdData = await cmdRes.json();
        newCmdStatus = cmdData.status;
        setCommandStatus(cmdData.status);
      }

      if (devRes.ok) {
        const devData = await devRes.json();
        setLocalDevice(devData);
      }

      // If command status just transitioned from active to idle, refetch baseline values!
      if (newCmdStatus === 'idle' && prevCommandStatusRef.current !== 'idle') {
        fetchCalibration();
      }
      prevCommandStatusRef.current = newCmdStatus;
    } catch (err) {
      console.error('Failed to poll IoT node status:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchCalibration();
    fetchDeviceStatus();
  }, [device.id]);

  // Polling loop
  useEffect(() => {
    // Poll fast if calibrating, warming up, or command active
    const isBusy = 
      localDevice.status === 'calibrating' || 
      localDevice.status === 'warming_up' || 
      localDevice.status === 'burn_in' || 
      commandStatus !== 'idle';
      
    const intervalTime = isBusy ? 2500 : 7500;
    
    pollStatus(); // Immediate poll
    const timer = setInterval(pollStatus, intervalTime);
    return () => clearInterval(timer);
  }, [device.id, localDevice.status, commandStatus]);

  const handleRecalibrate = async () => {
    setCommandStatus('pending');
    setError(null);
    try {
      const res = await customFetch(`/api/v1/calibration/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'RECALIBRATE' })
      });
      if (res.ok) {
        pollStatus();
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to queue recalibration command.');
        setCommandStatus('idle');
      }
    } catch (err) {
      setError(err.message || 'Server connection error.');
      setCommandStatus('idle');
    }
  };

  const handleReBurnIn = async () => {
    setCommandStatus('pending');
    setError(null);
    try {
      const res = await customFetch(`/api/v1/calibration/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'REBURNIN' })
      });
      if (res.ok) {
        pollStatus();
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to queue re-burnin command.');
        setCommandStatus('idle');
      }
    } catch (err) {
      setError(err.message || 'Server connection error.');
      setCommandStatus('idle');
    }
  };

  const formatNumber = (val) => val != null ? Number(val).toFixed(2) : '-';
  
  // Calculate burn-in progress percentage
  const createdTime = localDevice?.created_at ? new Date(localDevice.created_at).getTime() : Date.now();
  const elapsedMins = Math.floor((Date.now() - createdTime) / 60000);
  const elapsedHours = Math.floor(elapsedMins / 60);
  const remainingMins = elapsedMins % 60;
  const burnInPercent = Math.min(100, Math.max(0, (elapsedMins / 1440) * 100));

  // Determine LED class
  let statusLedClass = 'led-safe';
  if (localDevice.status === 'calibrating') statusLedClass = 'led-calibrating';
  else if (localDevice.status === 'warming_up') statusLedClass = 'led-warming-up';
  else if (localDevice.status === 'burn_in') statusLedClass = 'led-burn-in';
  else if (localDevice.status === 'offline') statusLedClass = 'led-warning bg-rose-500/10 border-rose-500/80';

  return (
    <div className="py-4 first:pt-0 last:pb-0 space-y-4">
      {/* Node Info Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusLedClass}`} />
            <h4 className="text-sm font-bold capitalize" style={{ color: 'var(--ifrit-text-primary)' }}>
              {localDevice.name}
            </h4>
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-mono border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}>
              {localDevice.firmware_version || 'v1.0.0'}
            </span>
          </div>
          <p className="text-[10px] font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
            MAC: {localDevice.mac_address || '-'}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs font-bold" style={{ 
            color: localDevice.status === 'online' ? 'var(--ifrit-safe)' : 
                   localDevice.status === 'calibrating' ? 'var(--ifrit-info)' :
                   localDevice.status === 'warming_up' ? 'var(--ifrit-warning)' :
                   localDevice.status === 'burn_in' ? 'var(--color-ifrit-warning)' : 'var(--ifrit-text-muted)'
          }}>
            {localDevice.status === 'calibrating' && 'Mengalibrasi'}
            {localDevice.status === 'warming_up' && 'Pemanasan'}
            {localDevice.status === 'burn_in' && 'Penstabilan (24 jam)'}
            {localDevice.status === 'online' && 'Online'}
            {localDevice.status === 'offline' && 'Offline'}
          </span>
        </div>
      </div>

      {/* Warning/Progress Banners */}
      {localDevice.status === 'calibrating' && (
        <div className="flex flex-col gap-1 p-3 rounded-lg border bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px] animate-pulse">
          <div className="flex items-center gap-1.5 font-bold">
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
            <span>Kalibrasi Ulang Sedang Berjalan</span>
          </div>
          <p className="opacity-80 leading-normal">
            Alat sedang menghitung ulang nilai dasar sensor gas MQ. Letakkan alat di udara bersih. (Butuh waktu ~15 menit).
          </p>
        </div>
      )}

      {localDevice.status === 'warming_up' && (
        <div className="flex flex-col gap-1 p-3 rounded-lg border bg-orange-500/10 text-orange-400 border-orange-500/20 text-[11px] animate-pulse">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
            <span>Pemanasan Sensor Aktif</span>
          </div>
          <p className="opacity-80 leading-normal">
            Sensor sedang dipanaskan agar stabil. Tombol perintah akan aktif setelah pemanasan selesai.
          </p>
        </div>
      )}

      {localDevice.status === 'burn_in' && (
        <div className="flex flex-col gap-1.5 p-3 rounded-lg border bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold">
            <Cpu className="w-3.5 h-3.5 text-yellow-500" />
            <span>Proses Penstabilan Sensor (Burn-in)</span>
          </div>
          <p className="opacity-80 leading-normal">
            Kandungan kimiawi sensor sedang distabilkan agar deteksi kebakaran & kebocoran gas lebih akurat.
          </p>
          <div className="mt-1 space-y-1">
            <div className="flex justify-between text-[9px] font-mono opacity-90">
              <span>Kemajuan: {burnInPercent.toFixed(1)}%</span>
              <span>{elapsedHours}j {remainingMins}m / 24j</span>
            </div>
            <div className="w-full h-1 bg-yellow-500/20 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full transition-all duration-1000" style={{ width: `${burnInPercent}%` }} />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-red-400 p-2.5 rounded border border-red-500/20 bg-red-500/10 text-[11px]">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Baseline R0 values */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold" style={{ color: 'var(--ifrit-text-secondary)' }}>
          <span>NILAI HAMBATAN DASAR SENSOR (R0)</span>
          {calibration?.calibrated_at && (
            <span className="text-[9px] font-normal" style={{ color: 'var(--ifrit-text-muted)' }}>
              Terakhir: {new Date(calibration.calibrated_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {!calibration ? (
          <div className="text-center py-4 border border-dashed rounded-lg" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <p className="text-[11px]" style={{ color: 'var(--ifrit-text-muted)' }}>Tidak ada data nilai dasar sensor.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg border flex flex-col justify-center" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <span className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-2 (Asap)</span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {formatNumber(calibration.r0_mq2)} <span className="text-[10px]" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span>
              </span>
            </div>
            <div className="p-2 rounded-lg border flex flex-col justify-center" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <span className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-4 (Metana)</span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {formatNumber(calibration.r0_mq4)} <span className="text-[10px]" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span>
              </span>
            </div>
            <div className="p-2 rounded-lg border flex flex-col justify-center" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <span className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-6 (LPG)</span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {formatNumber(calibration.r0_mq6)} <span className="text-[10px]" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span>
              </span>
            </div>
            <div className="p-2 rounded-lg border flex flex-col justify-center" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <span className="text-[9px]" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-9B (Karbon Monoksida)</span>
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {formatNumber(calibration.r0_mq9)} <span className="text-[10px]" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Button Controls */}
      <div className="grid grid-cols-2 gap-2 pt-1.5">
        <Button
          onClick={handleRecalibrate}
          disabled={commandStatus !== 'idle' || (localDevice.status !== 'online' && localDevice.status !== 'burn_in')}
          className="flex items-center justify-center gap-1 text-[11px] font-bold h-8 text-white cursor-pointer transition-colors shadow-sm"
          style={{ backgroundColor: 'var(--ifrit-brand)', hover: { backgroundColor: 'var(--ifrit-brand-hover)' } }}
        >
          {commandStatus === 'pending' ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menunggu...</>
          ) : commandStatus === 'in_progress' ? (
            <><RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" /> Mengalibrasi...</>
          ) : (
            <><RefreshCw className="w-3.5 h-3.5" /> Kalibrasi Ulang</>
          )}
        </Button>

        <Button
          onClick={handleReBurnIn}
          disabled={commandStatus !== 'idle' || (localDevice.status !== 'online' && localDevice.status !== 'burn_in')}
          className="flex items-center justify-center gap-1 text-[11px] font-bold h-8 text-white cursor-pointer bg-yellow-600 hover:bg-yellow-700 transition-colors shadow-sm"
        >
          <Cpu className="w-3.5 h-3.5" /> Stabilkan Ulang
        </Button>
      </div>
    </div>
  );
}

export default function RoomDeviceCalibration({ devices }) {
  if (!devices || devices.length === 0) return null;

  return (
    <div className="border rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
        <Cpu className="w-4 h-4 text-[var(--ifrit-brand)]" />
        <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Kalibrasi Sensor IoT</h3>
      </div>
      <div className="space-y-4 divide-y divide-[var(--ifrit-border)]">
        {devices.map(device => (
          <DeviceCalibrationItem key={device.id} device={device} />
        ))}
      </div>
    </div>
  );
}
