import { NavLink } from 'react-router-dom';
import { useUIStore } from '@/store/store';
import {
  LayoutDashboard,
  DoorOpen,
  Camera,
  Bell,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Flame,
  Wifi,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/rooms', icon: DoorOpen, label: 'Facility Map' },
  { to: '/cctv', icon: Camera, label: 'Live Video' },
  { to: '/devices', icon: Wifi, label: 'Device Settings' },
  { to: '/alerts', icon: Bell, label: 'Safety Alerts' },
  { to: '/settings/notifications', icon: Smartphone, label: 'Alert Contacts' },
];

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col border-r transition-transform duration-300 z-50
        ${collapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-56 md:w-64'}
      `}
      style={{
        backgroundColor: 'var(--ifrit-bg-primary)',
        borderColor: 'var(--ifrit-border)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 h-16 border-b`} style={{ borderColor: 'var(--ifrit-border)' }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ backgroundColor: 'var(--ifrit-brand)' }}>
          <Flame className="w-5 h-5 text-white" />
        </div>
        <span className={`font-bold text-lg tracking-tight ${collapsed ? 'hidden md:hidden' : ''}`} style={{ color: 'var(--ifrit-text-primary)' }}>
          IFRIT
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer
              ${isActive
                ? 'text-[var(--ifrit-brand)]'
                : 'text-[var(--ifrit-text-secondary)] hover:text-[var(--ifrit-text-primary)] hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: 'var(--ifrit-brand-subtle)' } : undefined
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div
                    className="absolute left-0 w-0.5 h-6 rounded-r"
                    style={{ backgroundColor: 'var(--ifrit-brand)' }}
                  />
                )}
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className="px-3 py-3 border-t space-y-3" style={{ borderColor: 'var(--ifrit-border)' }}>
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full py-2 rounded-md transition-colors cursor-pointer hover:bg-white/5"
          style={{ color: 'var(--ifrit-text-muted)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
