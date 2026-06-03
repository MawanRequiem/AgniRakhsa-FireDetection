import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle, Cpu, Clock } from 'lucide-react';
import { customFetch } from '@/lib/api';

export default function DeviceCalibrationDialog({ open, onOpenChange, device }) {
  const [calibration, setCalibration] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commandStatus, setCommandStatus] = useState('idle'); // idle, pending, in_progress
  const [error, setError] = useState(null);

  const createdTime = device?.created_at ? new Date(device.created_at).getTime() : Date.now();
  const elapsedMins = Math.floor((Date.now() - createdTime) / 60000);
  const elapsedHours = Math.floor(elapsedMins / 60);
  const remainingMins = elapsedMins % 60;
  const burnInPercent = Math.min(100, Math.max(0, (elapsedMins / 1440) * 100));

  useEffect(() => {
    let intervalId;
    if (open && device?.id) {
      fetchCalibration();
      pollStatus();
      intervalId = setInterval(pollStatus, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    }
  }, [open, device?.id]);

  const pollStatus = async () => {
    try {
      const res = await customFetch(`/api/v1/calibration/${device.id}/command-status`);
      if (res.ok) {
        const data = await res.json();
        setCommandStatus(data.status);
        if (data.status === 'idle' && commandStatus !== 'idle') {
          // If it just finished, fetch updated calibration
          fetchCalibration();
        }
      }
    } catch (err) {
      console.error("Failed to poll status", err);
    }
  };

  const fetchCalibration = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await customFetch(`/api/v1/calibration/${device.id}/latest`);
      if (res.ok) {
        const data = await res.json();
        setCalibration(data.calibrated === false ? null : data);
      } else {
        setError('Failed to fetch calibration data');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
    } finally {
      setIsLoading(false);
    }
  };

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
        pollStatus(); // Immediately trigger a poll
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to trigger recalibration');
        setCommandStatus('idle');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
      setCommandStatus('idle');
    }
  };

  const handleReburnIn = async () => {
    setCommandStatus('pending');
    setError(null);
    try {
      const res = await customFetch(`/api/v1/calibration/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'REBURNIN' })
      });
      if (res.ok) {
        pollStatus(); // Immediately trigger a poll
      } else {
        const err = await res.json();
        setError(err.detail || 'Failed to trigger re-burnin');
        setCommandStatus('idle');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to server');
      setCommandStatus('idle');
    }
  };

  const formatNumber = (val) => val != null ? Number(val).toFixed(2) : '—';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--ifrit-text-primary)' }}>Sensor Calibration</DialogTitle>
          <DialogDescription style={{ color: 'var(--ifrit-text-muted)' }}>
            Manage R0 resistance baseline for {device?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {device?.status === 'calibrating' && (
            <div className="mb-4 flex flex-col gap-1.5 p-3.5 rounded-lg border bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs animate-pulse">
              <div className="flex items-center gap-2 font-semibold">
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                <span>System Recalibration In Progress</span>
              </div>
              <p className="opacity-80 leading-relaxed">
                The device is currently recalculating its MQ sensor baseline R0 values. Please keep the device in clean air. This will take about 15 minutes.
              </p>
            </div>
          )}

          {device?.status === 'warming_up' && (
            <div className="mb-4 flex flex-col gap-1.5 p-3.5 rounded-lg border bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs animate-pulse">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="w-4 h-4 text-orange-500" />
                <span>Heater Warm-up Mode Active</span>
              </div>
              <p className="opacity-80 leading-relaxed">
                The MQ-series gas sensors are currently pre-heating to stabilize their internal elements (5 minutes). Telemetry and remote calibration will activate as soon as the warm-up completes.
              </p>
            </div>
          )}

          {device?.status === 'burn_in' && (
            <div className="mb-4 flex flex-col gap-2 p-3.5 rounded-lg border bg-yellow-500/10 text-yellow-500 border-yellow-500/20 text-xs">
              <div className="flex items-center gap-2 font-semibold">
                <Cpu className="w-4 h-4 text-yellow-500" />
                <span>24-Hour Physical Element Burn-In</span>
              </div>
              <p className="opacity-80 leading-relaxed">
                This device is within its initial 24-hour operation cycle. The chemical sensor baselines will adaptively self-calibrate and stabilize for industrial-grade accuracy.
              </p>
              <div className="mt-1 space-y-1">
                <div className="flex justify-between text-[10px] font-mono opacity-90">
                  <span>Progress: {burnInPercent.toFixed(1)}%</span>
                  <span>{elapsedHours}h {remainingMins}m / 24h</span>
                </div>
                <div className="w-full h-1.5 bg-yellow-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-500 rounded-full transition-all duration-1000" style={{ width: `${burnInPercent}%` }} />
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-6">
              <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--ifrit-brand)' }} />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400 p-3 rounded-md bg-red-400/10 text-sm">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          ) : !calibration ? (
             <div className="text-center py-6">
               <p className="text-sm mb-4" style={{ color: 'var(--ifrit-text-muted)' }}>No calibration data found for this device.</p>
             </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-2 (Smoke)</p>
                  <p className="font-mono text-lg" style={{ color: 'var(--ifrit-text-primary)' }}>{formatNumber(calibration.r0_mq2)} <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span></p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-4 (CH4)</p>
                  <p className="font-mono text-lg" style={{ color: 'var(--ifrit-text-primary)' }}>{formatNumber(calibration.r0_mq4)} <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span></p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-6 (LPG)</p>
                  <p className="font-mono text-lg" style={{ color: 'var(--ifrit-text-primary)' }}>{formatNumber(calibration.r0_mq6)} <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span></p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-9B (CO)</p>
                  <p className="font-mono text-lg" style={{ color: 'var(--ifrit-text-primary)' }}>{formatNumber(calibration.r0_mq9)} <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>kΩ</span></p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
                <span>Source: <span className="capitalize">{calibration.source}</span></span>
                <span>Last Calibrated: {new Date(calibration.calibrated_at).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: 'var(--ifrit-border)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--ifrit-text-muted)' }}>
            Ensure the device is in clean air before recalibrating. The process takes ~15 minutes.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button 
              onClick={handleRecalibrate} 
              disabled={commandStatus !== 'idle' || (device?.status !== 'online' && device?.status !== 'burn_in')}
              className="flex items-center justify-center gap-1.5 cursor-pointer text-white text-xs py-2" 
              style={{ backgroundColor: 'var(--ifrit-brand)' }}
            >
              {commandStatus === 'pending' ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Wait...</>
              ) : commandStatus === 'in_progress' ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-400" /> Calibrating...</>
              ) : (
                <><RefreshCw className="w-3.5 h-3.5" /> Recalibrate</>
              )}
            </Button>
            
            <Button 
              onClick={handleReburnIn} 
              disabled={commandStatus !== 'idle' || (device?.status !== 'online' && device?.status !== 'burn_in')}
              className="flex items-center justify-center gap-1.5 cursor-pointer text-white text-xs py-2 bg-yellow-600 hover:bg-yellow-700"
            >
              <Cpu className="w-3.5 h-3.5" /> Re-Burn In
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
