import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  csrfToken: null,
  isAuthenticated: false,
  isLoading: true, // starts loading while verifying session

  setAuth: (user, csrfToken) => set({ 
    user, 
    csrfToken, 
    isAuthenticated: !!user,
    isLoading: false 
  }),

  clearAuth: () => set({ 
    user: null, 
    csrfToken: null, 
    isAuthenticated: false,
    isLoading: false 
  }),

  setLoading: (isLoading) => set({ isLoading }),
}));
