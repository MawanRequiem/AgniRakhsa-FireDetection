import { useNotificationStore } from '@/stores/useNotificationStore';
import { X, AlertTriangle, Flame, MapPin, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * FireAlertToast — Full-screen overlay toast for critical fire detections.
 * 
 * Renders as a stack of animated toast cards at the top-right corner.
 * Critical alerts get a pulsing red border; high alerts get orange.
 */
export default function FireAlertToast() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const soundEnabled = useNotificationStore((s) => s.soundEnabled);
  const toggleSound = useNotificationStore((s) => s.toggleSound);

  const activeToasts = notifications.filter((n) => n.showToast);

  if (activeToasts.length === 0) return null;

  return (
    <div className="fire-toast-container">
      {/* Sound toggle */}
      <button
        onClick={toggleSound}
        className="fire-toast-sound-toggle"
        title={soundEnabled ? 'Matikan suara alarm' : 'Nyalakan suara alarm'}
      >
        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
      </button>

      {activeToasts.slice(0, 3).map((toast, idx) => (
        <div
          key={toast.id}
          className={`fire-toast-card ${toast.severity === 'critical' ? 'fire-toast-critical' : 'fire-toast-high'}`}
          style={{ '--toast-index': idx }}
        >
          {/* Close button */}
          <button
            onClick={() => dismissToast(toast.id)}
            className="fire-toast-close"
            aria-label="Tutup notifikasi"
          >
            <X size={16} />
          </button>

          {/* Header */}
          <div className="fire-toast-header">
            <div className="fire-toast-icon-wrap">
              {toast.severity === 'critical' ? (
                <Flame className="fire-toast-icon fire-toast-icon-critical" />
              ) : (
                <AlertTriangle className="fire-toast-icon fire-toast-icon-high" />
              )}
            </div>
            <div className="fire-toast-title-wrap">
              <span className="fire-toast-title">
                {toast.severity === 'critical' ? '🔴 KEBAKARAN KRITIS' : '🟠 PERINGATAN API'}
              </span>
              <span className="fire-toast-score">
                Skor bahaya: {(toast.fusionScore * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Location */}
          <div className="fire-toast-location">
            <MapPin size={14} />
            <span>{toast.roomName}</span>
          </div>

          {/* Detection image if available */}
          {toast.imageUrl && (
            <div className="fire-toast-image-wrap">
              <img
                src={toast.imageUrl}
                alt="Deteksi api oleh kamera"
                className="fire-toast-image"
                loading="eager"
              />
            </div>
          )}

          {/* Timestamp */}
          <div className="fire-toast-time">
            {toast.timestamp
              ? new Date(toast.timestamp).toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })
              : 'Baru saja'}
          </div>
        </div>
      ))}
    </div>
  );
}
