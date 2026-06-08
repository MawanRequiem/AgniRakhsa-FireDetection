import { create } from 'zustand';
import { customFetch } from '@/lib/api';

export const useAlertsStore = create((set, get) => ({
  roomsData: {},
  filters: {
    severity: null,
    roomId: null,
    acknowledged: false,
  },
  globalLoading: false,
  error: null,
  roomSummaries: [],
  isAcknowledgingRoom: null,

  _buildAlertParams: (roomId, page, f) => {
    const params = new URLSearchParams();
    params.set('room_id', roomId);
    params.set('page', String(page));
    params.set('page_size', '15');
    if (f.severity) params.set('severity', f.severity);
    if (f.acknowledged !== null && f.acknowledged !== undefined) {
      params.set('acknowledged', String(f.acknowledged));
    }
    return params;
  },

  fetchRoomPage: async (roomId, page, overrideFilters) => {
    const { filters, _buildAlertParams } = get();
    const f = overrideFilters || filters;

    try {
      set((state) => ({
        roomsData: {
          ...state.roomsData,
          [roomId]: {
            ...(state.roomsData[roomId] || { page: 1, pageSize: 15, total: 0, alerts: [] }),
            isLoading: true,
          },
        },
      }));

      const params = _buildAlertParams(roomId, page, f);
      const response = await customFetch(`/api/v1/alerts/?${params.toString()}`);

      if (response.ok) {
        const data = await response.json();
        set((state) => ({
          roomsData: {
            ...state.roomsData,
            [roomId]: {
              alerts: data.items || [],
              total: data.total || 0,
              page: data.page || page,
              pageSize: data.page_size || 15,
              isLoading: false,
            },
          },
        }));
      } else {
        throw new Error(`Failed to fetch alerts for room ${roomId}`);
      }
    } catch (error) {
      set((state) => ({
        error: error.message,
        roomsData: {
          ...state.roomsData,
          [roomId]: {
            ...(state.roomsData[roomId] || { page: 1, pageSize: 15, total: 0, alerts: [] }),
            isLoading: false,
          },
        },
      }));
    }
  },

  fetchAllFirstPages: async (overrideFilters) => {
    const { filters } = get();
    const f = overrideFilters || filters;

    try {
      set({ globalLoading: true, error: null });

      const roomFilter = f.roomId ? { room_id: f.roomId } : {};
      const summaryBody = { severity: f.severity || null };
      if (roomFilter.room_id) {
        summaryBody.room_id = roomFilter.room_id;
      }

      const [summaryRes] = await Promise.all([
        customFetch('/api/v1/alerts/room-summary', {
          method: 'POST',
          body: JSON.stringify(summaryBody),
        }),
      ]);

      const summaryData = summaryRes.ok ? await summaryRes.json() : { rooms: [] };
      const rooms = summaryData.rooms || [];

      set({ roomSummaries: rooms });

      const roomsWithAlerts = rooms.filter((r) => r.total_alerts > 0);

      if (roomsWithAlerts.length === 0) {
        set({ roomsData: {}, globalLoading: false });
        return;
      }

      const { _buildAlertParams } = get();
      const pageFetches = roomsWithAlerts.map((room) => {
        const params = _buildAlertParams(room.room_id, 1, f);
        return customFetch(`/api/v1/alerts/?${params.toString()}`).then((res) =>
          res.ok ? res.json().then((d) => ({ roomId: room.room_id, data: d })) : { roomId: room.room_id, error: true }
        );
      });

      const results = await Promise.all(pageFetches);

      const newRoomsData = {};
      for (const r of results) {
        if (r.error) continue;
        newRoomsData[r.roomId] = {
          alerts: r.data.items || [],
          total: r.data.total || 0,
          page: 1,
          pageSize: 15,
          isLoading: false,
        };
      }

      set({ roomsData: newRoomsData, globalLoading: false });
    } catch (error) {
      set({ error: error.message, globalLoading: false });
    }
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      roomsData: {},
    }));
  },

  acknowledgeAlert: async (alertId, roomId) => {
    try {
      const response = await customFetch(`/api/v1/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      });
      if (response.ok) {
        set((state) => {
          const roomData = state.roomsData[roomId];
          if (!roomData) return state;
          return {
            roomsData: {
              ...state.roomsData,
              [roomId]: {
                ...roomData,
                alerts: roomData.alerts.map((a) =>
                  a.id === alertId ? { ...a, is_acknowledged: true } : a
                ),
              },
            },
          };
        });
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
      set({ isAcknowledgingRoom: roomId });
      const response = await customFetch(`/api/v1/alerts/acknowledge-room/${roomId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        set((state) => {
          const currentRoom = state.roomsData[roomId];
          return {
            roomsData: {
              ...state.roomsData,
              [roomId]: currentRoom
                ? {
                    ...currentRoom,
                    alerts: currentRoom.alerts.map((a) => ({
                      ...a,
                      is_acknowledged: true,
                    })),
                  }
                : currentRoom,
            },
            roomSummaries: state.roomSummaries.map((s) =>
              s.room_id === roomId
                ? { ...s, total_alerts: s.total_alerts - s.unacknowledged_count, unacknowledged_count: 0 }
                : s
            ),
            isAcknowledgingRoom: null,
          };
        });
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
