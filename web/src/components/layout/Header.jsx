import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Bell, Clock, Menu, User, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useUIStore } from '@/store/store';
import { useAuthStore } from '@/stores/useAuthStore'; // Tambahkan import store auth
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { customFetch } from '@/lib/api'; // Tambahkan import API
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, buttonVariants } from '../ui/button';
import { cn } from '../../lib/utils';

// Update key agar sesuai dengan rute /dashboard/... di App.jsx
const pageTitles = {
  '/dashboard': 'Dashboard',
  '/dashboard/rooms': 'Rooms',
  '/dashboard/cctv': 'CCTV Monitor',
  '/dashboard/alerts': 'Alerts',
  '/dashboard/settings/notifications': 'Notifications',
};

const StatusDot = ({ severity }) => {
  const colors = {
    critical: 'bg-[var(--agni-fire)] shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    high: 'bg-[var(--agni-fire)] shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    fire: 'bg-[var(--agni-fire)] shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    warning: 'bg-[var(--agni-warning)] shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    medium: 'bg-[var(--agni-warning)] shadow-[0_0_6px_rgba(245,158,11,0.4)]',
    info: 'bg-[var(--agni-info)]'
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[severity] || colors.info}`} />;
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate(); // Hook untuk navigasi
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const recentAlerts = useDashboardStore((s) => s.recentAlerts);
  const { user, clearAuth } = useAuthStore(); // Ambil info user dan fungsi logout
  
  const activeAlerts = recentAlerts.filter(a => !a.is_acknowledged);
  const alertCount = activeAlerts.length;

  // Sesuaikan pengecekan path detail ruangan
  const title = location.pathname.startsWith('/dashboard/rooms/')
    ? 'Room Detail'
    : pageTitles[location.pathname] || 'AgniRaksha';

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

  // Fungsi Logout yang baru
  const handleLogout = async () => {
    try {
      // 1. Beritahu backend untuk hapus session
      await customFetch('/api/v1/auth/logout', { method: 'POST' });
      
      // 2. Hapus data auth dari memori (Zustand)
      clearAuth();
      
      // 3. Langsung pindah ke Landing Page
      navigate('/', { replace: true });
    } catch (error) {
      console.error("Logout gagal:", error);
      clearAuth();
      navigate('/', { replace: true });
    }
  };

  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 border-b sticky top-0 z-30"
      style={{
        backgroundColor: 'var(--agni-bg-primary)',
        borderColor: 'var(--agni-border)',
      }}
    >
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-[var(--agni-text-primary)]"
          onClick={toggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--agni-text-primary)' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <div className="hidden lg:flex items-center gap-2 text-xs" style={{ color: 'var(--agni-text-muted)' }}>
          <Clock className="w-4 h-4" />
          <span className="font-mono font-medium">{timeStr}</span>
          <span className="mx-1 opacity-30">|</span>
          <span className="font-medium">{dateStr}</span>
        </div>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative group")}>
            <Bell className="w-5 h-5 text-[var(--agni-text-secondary)] group-hover:text-[var(--agni-text-primary)] transition-colors" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full text-white bg-[var(--agni-fire)]">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden" style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)' }}>
            <div className="p-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--agni-border)', backgroundColor: 'var(--agni-bg-secondary)' }}>
              <span className="font-semibold text-sm">Recent Alerts</span>
              <span className="text-xs text-[var(--agni-text-muted)]">{alertCount} requires action</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {activeAlerts.length > 0 ? (
                activeAlerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="p-3 border-b hover:bg-[var(--agni-bg-secondary)] transition-colors break-words flex gap-3 cursor-pointer" style={{ borderColor: 'var(--agni-border-light)' }}>
                    <div className="mt-1"><StatusDot severity={alert.severity} /></div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs font-medium text-[var(--agni-text-primary)] line-clamp-1">{alert.alert_type || 'Alert'}</p>
                       <p className="text-xs text-[var(--agni-text-secondary)] line-clamp-2 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center flex flex-col items-center gap-2">
                  <ShieldCheck className="w-8 h-8 text-[var(--agni-safe)] opacity-80" />
                  <p className="text-sm font-medium text-[var(--agni-text-secondary)]">All clear!</p>
                </div>
              )}
            </div>
            <div className="p-2 border-t text-center" style={{ borderColor: 'var(--agni-border)' }}>
              <Link to="/dashboard/alerts" className="text-xs font-medium text-[var(--agni-amber)] hover:text-[var(--agni-amber-hover)]">
                View all alerts
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "group rounded-full bg-[var(--agni-bg-secondary)] border")}>
            <User className="w-4 h-4 text-[var(--agni-text-primary)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)' }}>
            <div className="px-2 py-1.5 mb-1 flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-[var(--agni-text-primary)]">
                {user?.email?.split('@')[0].toUpperCase() || 'ADMIN'}
              </p>
              <p className="text-xs leading-none text-[var(--agni-text-muted)]">
                {user?.email || 'admin@agniraksha.local'}
              </p>
            </div>

            <DropdownMenuSeparator style={{ backgroundColor: 'var(--agni-border-light)' }} />
            
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings/notifications" className="cursor-pointer flex items-center p-2 text-sm text-[var(--agni-text-secondary)] hover:text-[var(--agni-text-primary)]">
                <Settings className="mr-2 w-4 h-4" />
                <span>Notification Settings</span>
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator style={{ backgroundColor: 'var(--agni-border-light)' }} />
            
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-[var(--agni-fire)] flex items-center p-2 text-sm cursor-pointer hover:bg-[rgba(239,68,68,0.1)]"
            >
              <LogOut className="mr-2 w-4 h-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}