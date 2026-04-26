import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

// Common suspense fallback
const PageFallback = () => (
  <div className="flex items-center justify-center p-12 w-full h-64">
    <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--ifrit-border)', borderTopColor: 'var(--ifrit-brand)' }} />
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
  const { setAuth, clearAuth } = useAuthStore();

  // Verify HttpOnly Cookie Session on initial app load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await customFetch('/api/v1/auth/me');
        if (response.ok) {
          const user = await response.json();
          const resCsrf = response.headers.get('X-CSRF-Token');
          setAuth(user, resCsrf || '');
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
    <div className="min-h-screen" style={{ color: 'var(--ifrit-text-primary)', backgroundColor: 'var(--ifrit-bg-primary)' }}>
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
              <h2 className="text-2xl font-bold mb-2">404 — Page Not Found</h2>
              <p style={{ color: 'var(--ifrit-text-muted)' }}>The page you're looking for doesn't exist.</p>
            </div>
          } />
        </Route>
      </Routes>
    </div>
  );
}

export default App;
