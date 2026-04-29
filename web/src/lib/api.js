import { useAuthStore } from '@/stores/useAuthStore';

const getBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  const { hostname, protocol } = globalThis.location;

  // Jika kita sedang di server (bukan localhost) tapi ENV masih tertulis localhost,
  // maka kita paksa gunakan IP server saat ini agar tidak error.
  if (hostname !== 'localhost' && envUrl && envUrl.includes('localhost')) {
    return `${protocol}//${hostname}:8000`;
  }

  if (envUrl) return envUrl;
  if (hostname === 'localhost') return 'http://localhost:8000';
  return `${protocol}//${hostname}:8000`;
};

const BASE_URL = getBaseUrl();

export async function customFetch(endpoint, options = {}) {
  // Always include credentials to send HttpOnly cookies
  const fetchOptions = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Skip CSRF logic for GET and HEAD requests
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    // Dynamically inject CSRF token from Zustand state
    const { csrfToken } = useAuthStore.getState();
    if (csrfToken) {
      fetchOptions.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  // Ensure content-type wasn't overridden to null (e.g. for FormData)
  if (!fetchOptions.headers['Content-Type']) {
    delete fetchOptions.headers['Content-Type'];
  }
  
  // If sending FormData, browser must set Content-Type with boundary automatically
  if (options.body instanceof FormData || options.body instanceof URLSearchParams) {
    if (fetchOptions.headers['Content-Type'] === 'application/json') {
      if (options.body instanceof URLSearchParams) {
        fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        delete fetchOptions.headers['Content-Type'];
      }
    }
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, fetchOptions);

  // Handle global 401 unauthenticated
  if (response.status === 401 || response.status === 403) {
      // Don't auto clear if it's the login endpoint itself that failed 401
      if (!endpoint.includes('/auth/login')) {
        useAuthStore.getState().clearAuth();
      }
  }

  return response;
}
