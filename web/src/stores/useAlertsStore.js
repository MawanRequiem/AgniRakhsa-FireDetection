import { create } from 'zustand';
import { customFetch } from '@/lib/api';

export const useAlertsStore = create((set, get) => ({
  alerts: [],
  total: 0,
  page: 1,
  pageSize: 30,
  filters: {
    severity: null,
    roomId: null,
    acknowledged: null,
  },
  isLoading: false,
  error: null,
  roomSummaries: [],
  isAcknowledgingRoom: null,

  fetchAlerts: async (overrideFilters) => {
    const { page, pageSize, filters } = get();
    const f = overrideFilters || filters;

    try {
      set({ isLoading: true, error: null });

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('page_size', String(pageSize));
      if (f.severity) params.set('severity', f.severity);
      if (f.roomId) params.set('room_id', f.roomId);
      if (f.acknowledged !== null && f.acknowledged !== undefined) {
        params.set('acknowledged', String(f.acknowledged));
      }

      const [alertsRes, summaryRes] = await Promise.all([
        customFetch(`/api/v1/alerts/?${params.toString()}`),
        customFetch('/api/v1/alerts/room-summary', {
          method: 'POST',
          body: JSON.stringify({
            severity: f.severity || null,
            acknowledged: f.acknowledged !== undefined ? f.acknowledged : null,
          }),
        }),
      ]);

      if (alertsRes.ok) {
        const data = await alertsRes.json();
        set({
          alerts: data.items || [],
          total: data.total || 0,
          isLoading: false,
        });
      } else {
        throw new Error('Failed to fetch alerts');
      }

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        set({ roomSummaries: summaryData.rooms || [] });
      }
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      page: 1,
    }));
  },

  setPage: (page) => set({ page }),

  acknowledgeAlert: async (alertId) => {
    try {
      const response = await customFetch(`/api/v1/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      if (response.ok) {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === alertId ? { ...a, is_acknowledged: true } : a
          ),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      return false;
    }
  },

  acknowledgeRoom: async (roomId) => {
    try {
      const response = await customFetch(`/api/v1/alerts/acknowledge-room/${roomId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.room_id === roomId ? { ...a, is_acknowledged: true } : a
          ),
          roomSummaries: state.roomSummaries.map((s) =>
            s.room_id === roomId
              ? { ...s, total_alerts: s.total_alerts - s.unacknowledged_count, unacknowledged_count: 0 }
              : s
          ),
          isAcknowledgingRoom: null,
        }));
        return data;
      }
      set({ isAcknowledgingRoom: null });
      return null;
    } catch (error) {
      console.error('Failed to acknowledge room alerts:', error);
      set({ isAcknowledgingRoom: null });
      return null;
    }
  },

  setAcknowledgingRoom: (roomId) => set({ isAcknowledgingRoom: roomId }),
}));
