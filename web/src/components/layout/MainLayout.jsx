import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '@/store/store';
import { useEffect } from 'react';

export default function MainLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  // Auto-collapse sidebar on mobile startup
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !useUIStore.getState().sidebarCollapsed) {
        useUIStore.setState({ sidebarCollapsed: true });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen text-[var(--ifrit-text-primary)]" style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}>
      {/* Mobile Overlay — solid dark, no blur */}
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={toggle}
        />
      )}

      <Sidebar />

      {/* Main Content Area */}
      <div className="transition-all duration-300 min-h-screen flex flex-col">
        <div className={`flex flex-col flex-1 ${collapsed ? 'md:ml-16' : 'md:ml-64'}`}>
          <Header />
          <main className="p-4 sm:p-6 lg:p-8 flex-1 animate-fade-in">
            <div className="max-w-7xl mx-auto w-full">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
