import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { customFetch } from '@/lib/api';

export default function DeviceCalibrationDialog({ open, onOpenChange, device }) {
  const [calibration, setCalibration] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [commandStatus, setCommandStatus] = useState('idle'); // idle, pending, in_progress
  const [error, setError] = useState(null);

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
                  <p className="text-xs mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>MQ-9 (CO)</p>
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
            Ensure the device is in clean air before recalibrating. The process takes ~10 seconds.
          </p>
          <Button 
            onClick={handleRecalibrate} 
            disabled={commandStatus !== 'idle' || device?.status !== 'online'}
            className="w-full flex items-center justify-center gap-2 cursor-pointer text-white" 
            style={{ backgroundColor: 'var(--ifrit-brand)' }}
          >
            {commandStatus === 'pending' ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Waiting for device...</>
            ) : commandStatus === 'in_progress' ? (
              <><RefreshCw className="w-4 h-4 animate-spin text-orange-400" /> Device Calibrating...</>
            ) : (
              <><RefreshCw className="w-4 h-4" /> Trigger Remote Calibration</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
