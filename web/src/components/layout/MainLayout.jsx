import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useUIStore } from '@/store/store';
import { useEffect } from 'react';

export default function MainLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  // Auto-collapse sidebar pada tampilan mobile saat startup
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !useUIStore.getState().sidebarCollapsed) {
        useUIStore.setState({ sidebarCollapsed: true });
      }
    };
    handleResize(); // Pengecekan awal
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    // Menggunakan warna latar belakang gelap yang konsisten dengan Landing Page & Login
    <div className="min-h-screen bg-[#0a0a0b] text-white overflow-x-hidden">
      
      {/* Mobile Overlay: Menutup sidebar saat diklik di perangkat mobile */}
      {!collapsed && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300"
          onClick={toggle}
        />
      )}

      {/* Sidebar Component: Berisi menu Dashboard, CCTV, dll. */}
      <Sidebar />

      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 min-h-screen flex flex-col ${
          collapsed ? 'md:ml-16' : 'md:ml-64'
        }`}
      >
        {/* Header: Berisi jam, profil, dan toggle sidebar */}
        <Header />
        
        {/* Konten Utama: Tempat merender Dashboard, Rooms, dsb. */}
        <main className="p-4 sm:p-6 lg:p-10 flex-1">
          <div className="max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Komponen dari Route akan muncul di sini (misal: Dashboard.jsx) */}
            <Outlet />
          </div>
        </main>

        {/* Footer Panel Admin */}
        <footer className="p-6 text-center text-gray-600 text-[10px] uppercase tracking-[0.2em] border-t border-white/5">
          &copy; 2026 AgniRaksha Systems - PBL PNJ
        </footer>
      </div>
    </div>
  );
}