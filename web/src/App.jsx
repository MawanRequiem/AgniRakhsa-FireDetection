import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';

// Eager load critical routes
import Dashboard from '@/pages/Dashboard';
import Rooms from '@/pages/Rooms';
import RoomDetail from '@/pages/RoomDetail';

// Lazy load non-critical / heavy routes
const CCTVMonitor = lazy(() => import('@/pages/CCTVMonitor'));
const Alerts = lazy(() => import('@/pages/Alerts'));
const Notifications = lazy(() => import('@/pages/Notifications'));

// Common suspense fallback (simple spinner using Warm Industrial colors)
const PageFallback = () => (
  <div className="flex items-center justify-center p-12 w-full h-64">
    <div className="w-8 h-8 rounded-full border-2 border-[var(--agni-border)] border-t-[var(--agni-amber)] animate-spin" />
  </div>
);

function App() {
  return (
    <div className="min-h-screen text-[var(--agni-text-primary)]" style={{ backgroundColor: 'var(--agni-bg-primary)' }}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="rooms/:id" element={<RoomDetail />} />
          
          <Route path="cctv" element={
            <Suspense fallback={<PageFallback />}>
              <CCTVMonitor />
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
