import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Bell, Clock, Menu, User, Settings, LogOut, ShieldCheck, Globe } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useUIStore } from '@/store/store';
import { customFetch } from '@/lib/api';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { translations, getLocalizedMessage } from '@/lib/translations';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button, buttonVariants } from '../ui/button';
import { cn } from '../../lib/utils';

const pageTitleKeys = {
  '/dashboard': 'summary',
  '/dashboard/rooms': 'building_map',
  '/dashboard/cctv': 'cctv',
  '/dashboard/devices': 'sensor_settings',
  '/dashboard/alerts': 'alerts_report',
  '/dashboard/settings/notifications': 'recipients',
};

const StatusDot = ({ severity }) => {
  const colors = {
    critical: 'bg-[var(--ifrit-fire)]',
    high: 'bg-[var(--ifrit-fire)]',
    fire: 'bg-[var(--ifrit-fire)]',
    warning: 'bg-[var(--ifrit-warning)]',
    medium: 'bg-[var(--ifrit-warning)]',
    info: 'bg-[var(--ifrit-info)]'
  };
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[severity] || colors.info}`} />;
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const language = useUIStore((s) => s.language);
  const setLanguage = useUIStore((s) => s.setLanguage);
  const recentAlerts = useDashboardStore((s) => s.recentAlerts);
  const { user, clearAuth } = useAuthStore();
  
  const activeAlerts = recentAlerts.filter(a => !a.is_acknowledged);
  const alertCount = activeAlerts.length;

  const t = translations[language] || translations['en'];

  const titleKey = pageTitleKeys[location.pathname];
  const title = location.pathname.startsWith('/dashboard/rooms/')
    ? t['room_detail']
    : titleKey ? t[titleKey] : 'IFRIT';

  const now = new Date();
  const timeLocale = language === 'en' ? 'en-US' : 'id-ID';
  const timeStr = now.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString(timeLocale, { weekday: 'short', day: 'numeric', month: 'short' });

  const handleLogout = async () => {
    try {
      await customFetch('/api/v1/auth/logout', { method: 'POST' });
      clearAuth();
      navigate('/', { replace: true });
    } catch (error) {
      console.error(t['logout_failed'], error);
      clearAuth();
      navigate('/', { replace: true });
    }
  };

  return (
    <header
      className="h-16 flex items-center justify-between px-4 sm:px-6 border-b sticky top-0 z-30"
      style={{
        backgroundColor: 'var(--ifrit-bg-primary)',
        borderColor: 'var(--ifrit-border)',
      }}
    >
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden text-[var(--ifrit-text-primary)]"
          onClick={toggleSidebar}
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-lg sm:text-xl font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Date & Time (Hidden on small screens) */}
        <div className="hidden lg:flex items-center gap-2 text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
          <Clock className="w-4 h-4" />
          <span className="font-mono font-medium">{timeStr}</span>
          <span className="mx-1 opacity-30">|</span>
          <span className="font-medium">{dateStr}</span>
        </div>

        {/* Language Switcher */}
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 text-[var(--ifrit-text-secondary)] hover:text-[var(--ifrit-text-primary)] relative group"
          onClick={() => setLanguage(language === 'en' ? 'id' : 'en')}
          title={language === 'en' ? 'Switch to Bahasa Indonesia' : 'Ubah ke Bahasa Inggris'}
        >
          <Globe className="w-5 h-5" />
          <span className="absolute -bottom-1 -right-1 text-[8px] font-bold bg-[var(--ifrit-bg-secondary)] border px-1 rounded-full uppercase">
            {language}
          </span>
        </Button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger 
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative group")}
          >
            <Bell className="w-5 h-5 text-[var(--ifrit-text-secondary)] group-hover:text-[var(--ifrit-text-primary)] transition-colors" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold rounded-full text-white bg-[var(--ifrit-fire)]">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="p-3 border-b flex justify-between items-center" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <span className="font-semibold text-sm">{t['recent_alerts']}</span>
              <span className="text-xs text-[var(--ifrit-text-muted)]">{alertCount} {t['needs_action']}</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {activeAlerts.length > 0 ? (
                activeAlerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="p-3 border-b hover:bg-[var(--ifrit-bg-secondary)] transition-colors break-words flex gap-3 cursor-pointer" style={{ borderColor: 'var(--ifrit-border)' }}>
                    <div className="mt-1"><StatusDot severity={alert.severity} /></div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs font-medium text-[var(--ifrit-text-primary)] line-clamp-1">{alert.alert_type === 'fire' ? t['fire'] : alert.alert_type || t['warning']}</p>
                       <p className="text-xs text-[var(--ifrit-text-secondary)] line-clamp-2 mt-0.5">{getLocalizedMessage(alert.message, language)}</p>
                       <span className="text-[10px] text-[var(--ifrit-text-muted)] block mt-1">
                         {alert.created_at ? new Date(alert.created_at).toLocaleString(timeLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : t['just_now']}
                       </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center flex flex-col items-center gap-2">
                  <ShieldCheck className="w-8 h-8 text-[var(--ifrit-safe)] opacity-80" />
                  <p className="text-sm font-medium text-[var(--ifrit-text-secondary)]">{t['all_safe']}</p>
                  <p className="text-xs text-[var(--ifrit-text-muted)]">{t['no_active_alerts']}</p>
                </div>
              )}
            </div>
            <div className="p-2 border-t text-center" style={{ borderColor: 'var(--ifrit-border)' }}>
              <Link to="/dashboard/alerts" className="text-xs font-medium text-[var(--ifrit-brand)] hover:text-[var(--ifrit-brand-hover)]">
                {t['view_all_alerts']}
              </Link>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger 
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "group rounded-full bg-[var(--ifrit-bg-secondary)] border")}
          >
            <User className="w-4 h-4 text-[var(--ifrit-text-primary)]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="px-2 py-1.5 mb-1 flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-[var(--ifrit-text-primary)]">{t['admin']}</p>
              <p className="text-xs leading-none text-[var(--ifrit-text-muted)]">{t['system']}</p>
            </div>
            <DropdownMenuSeparator style={{ backgroundColor: 'var(--ifrit-border)' }} />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/settings/notifications" className="cursor-pointer flex items-center p-2 text-sm text-[var(--ifrit-text-secondary)] hover:text-[var(--ifrit-text-primary)]">
                <Settings className="mr-2 w-4 h-4" />
                <span>{t['settings']}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: 'var(--ifrit-border)' }} />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-[var(--ifrit-fire)] flex items-center p-2 text-sm cursor-pointer hover:bg-[rgba(239,68,68,0.1)]"
            >
              <LogOut className="mr-2 w-4 h-4" />
              <span>{t['logout']}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}