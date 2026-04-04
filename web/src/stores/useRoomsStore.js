import { create } from 'zustand';
import { customFetch } from '@/lib/api';

export const useRoomsStore = create((set) => ({
  rooms: [],
  selectedRoom: null,
  isLoading: false,
  error: null,

  fetchRooms: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await customFetch('/api/v1/rooms/');
      if (response.ok) {
        const data = await response.json();
        set({ rooms: data || [], isLoading: false });
      } else {
        throw new Error('Failed to fetch rooms');
      }
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchRoomDetail: async (roomId) => {
    try {
      set({ isLoading: true, error: null });
      const response = await customFetch(`/api/v1/rooms/${roomId}`);
      if (response.ok) {
        const data = await response.json();
        set({ selectedRoom: data, isLoading: false });
        return data;
      } else if (response.status === 404) {
        set({ selectedRoom: null, isLoading: false, error: 'Room not found' });
        return null;
      } else {
        throw new Error('Failed to fetch room detail');
      }
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  clearSelectedRoom: () => set({ selectedRoom: null }),
}));
