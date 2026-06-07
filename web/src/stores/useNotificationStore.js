import { create } from 'zustand';

/**
 * Notification store for in-app real-time fire alert notifications.
 * 
 * Manages notification lifecycle: receive from WebSocket → display toast → 
 * persist in bell panel → mark as read → clear.
 */
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  soundEnabled: true,

  /**
   * Add a new notification from a FIRE_ALERT WebSocket event.
   * Triggers toast display and optional alarm sound.
   */
  addNotification: (alertData) => {
    const notification = {
      id: alertData.alert_id || crypto.randomUUID(),
      roomName: alertData.room_name || 'Ruangan Tidak Diketahui',
      severity: alertData.severity || 'high',
      riskLevel: alertData.risk_level || 'high',
      fusionScore: alertData.fusion_score || 0,
      imageUrl: alertData.image_url || null,
      sensorSummary: alertData.sensor_summary || '',
      explanationEn: alertData.explanation_en || '',
      explanationId: alertData.explanation_id || '',
      timestamp: alertData.timestamp || new Date().toISOString(),
      isRead: false,
      showToast: true,
    };

    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));

    // Play alarm sound for critical/high alerts
    const { soundEnabled } = get();
    if (soundEnabled && (notification.severity === 'critical' || notification.severity === 'high')) {
      _playAlarmSound(notification.severity);
    }

    // Auto-dismiss toast after 8 seconds
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === notification.id ? { ...n, showToast: false } : n
        ),
      }));
    }, 8000);

    return notification;
  },

  dismissToast: (notificationId) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === notificationId ? { ...n, showToast: false } : n
      ),
    }));
  },

  markAsRead: (notificationId) => {
    set((state) => {
      const target = state.notifications.find((n) => n.id === notificationId);
      if (!target || target.isRead) return state;

      return {
        notifications: state.notifications.map((n) =>
          n.id === notificationId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  toggleSound: () => {
    set((state) => ({ soundEnabled: !state.soundEnabled }));
  },
}));


/**
 * Play a short alarm sound using Web Audio API.
 * Critical = rapid pulsing, High = steady tone.
 */
function _playAlarmSound(severity) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    if (severity === 'critical') {
      // Rapid alarm pulse
      oscillator.frequency.value = 880;
      oscillator.type = 'square';
      gainNode.gain.value = 0.15;

      // Pulsing effect
      const pulseInterval = setInterval(() => {
        gainNode.gain.value = gainNode.gain.value > 0 ? 0 : 0.15;
      }, 150);

      oscillator.start();
      setTimeout(() => {
        clearInterval(pulseInterval);
        oscillator.stop();
        ctx.close();
      }, 1200);
    } else {
      // Steady warning tone
      oscillator.frequency.value = 660;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
      }, 600);
    }
  } catch (e) {
    // Web Audio API not available - silently ignore
    console.debug('Audio notification not available:', e.message);
  }
}
