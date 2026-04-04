import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { useAuthStore } from '@/stores/useAuthStore';
import { customFetch } from '@/lib/api';

// Eager load critical routes
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Rooms from '@/pages/Rooms';
import RoomDetail from '@/pages/RoomDetail';

// Lazy load non-critical / heavy routes
const CCTVMonitor = lazy(() => import('@/pages/CCTVMonitor'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const DeviceManagement = lazy(() => import('@/pages/DeviceManagement'));

// Common suspense fallback (simple spinner using Warm Industrial colors)
const PageFallback = () => (
  <div className="flex items-center justify-center p-12 w-full h-64">
    <div className="w-8 h-8 rounded-full border-2 border-[var(--agni-border)] border-t-[var(--agni-amber)] animate-spin" />
  </div>
);

// Secure Route Protection using in-memory Zustand store
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <PageFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();

  // Verify HttpOnly Cookie Session on initial app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await customFetch('/api/v1/auth/me');
        if (response.ok) {
          const user = await response.json();
          // We don't get the CSRF token from /me natively right now, but 
          // we should update /me to return it if needed, or rely on it staying valid if session valid.
          // Wait, backend /login gave us the CSRF token. If user refreshes, we lose CSRF token from memory!
          // But since the cookie is still there, /me succeeds.
          // We need CSRF token for future POST requests!
          // We will retrieve a new CSRF token on boot from /me or we'll modify /me right after this.
          const resCsrf = response.headers.get('X-CSRF-Token');
          setAuth(user, resCsrf || ''); // We will patch /me to return a new or same CSRF token.
        } else {
          clearAuth();
        }
      } catch (error) {
        console.error("Session verification failed", error);
        clearAuth();
      }
    };
    checkSession();
  }, [setAuth, clearAuth]);

  return (
    <div className="min-h-screen text-[var(--agni-text-primary)]" style={{ backgroundColor: 'var(--agni-bg-primary)' }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="rooms/:id" element={<RoomDetail />} />
          
          <Route path="cctv" element={
            <Suspense fallback={<PageFallback />}>
              <CCTVMonitor />
            </Suspense>
          } />

          <Route path="devices" element={
            <Suspense fallback={<PageFallback />}>
              <DeviceManagement />
            </Suspense>
          } />
          
          <Route path="alerts" element={
            <Suspense fallback={<PageFallback />}>
              <Alerts />
            </Suspense>
          } />
          
          <Route path="settings/notifications" element={
            <Suspense fallback={<PageFallback />}>
              <Notifications />
            </Suspense>
          } />

          {/* Catch-all route */}
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <h2 className="text-2xl font-bold mb-2">404 - Page Not Found</h2>
              <p style={{ color: 'var(--agni-text-muted)' }}>The module you are looking for does not exist.</p>
            </div>
          } />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
