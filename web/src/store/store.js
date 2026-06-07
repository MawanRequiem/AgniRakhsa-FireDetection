import { create } from 'zustand';

export const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  selectedSeverityFilter: 'all',
  setSeverityFilter: (filter) => set({ selectedSeverityFilter: filter }),

  selectedRoomFilter: 'all',
  setRoomFilter: (filter) => set({ selectedRoomFilter: filter }),

  language: localStorage.getItem('language') || 'en',
  setLanguage: (lang) => {
    localStorage.setItem('language', lang);
    set({ language: lang });
  },
}));

