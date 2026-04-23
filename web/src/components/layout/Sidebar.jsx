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
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/cctv', icon: Camera, label: 'CCTV' },
  { to: '/devices', icon: Wifi, label: 'Devices' },
];

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col border-r transition-transform duration-300 z-50
        ${collapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-64'}
      `}
      style={{
        backgroundColor: 'var(--agni-bg-primary)',
        borderColor: 'var(--agni-border)',
      }}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 h-16 border-b`} style={{ borderColor: 'var(--agni-border)' }}>
        <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ backgroundColor: 'var(--agni-amber)' }}>
          <Flame className="w-5 h-5 text-white" />
        </div>
        {(!collapsed || typeof window !== 'undefined' && window.innerWidth < 768) && (
          <span className="font-semibold text-lg tracking-tight" style={{ color: 'var(--agni-text-primary)' }}>
            AgniRaksha
          </span>
        )}
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
                ? 'text-[var(--agni-amber)]'
                : 'text-[var(--agni-text-secondary)] hover:text-[var(--agni-text-primary)] hover:bg-white/5'
              }`
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: 'rgba(245, 158, 11, 0.08)' } : undefined
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div
                    className="absolute left-0 w-0.5 h-6 rounded-r"
                    style={{ backgroundColor: 'var(--agni-amber)' }}
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
      <div className="px-3 py-3 border-t space-y-3" style={{ borderColor: 'var(--agni-border)' }}>
        {/* Collapse Toggle */}
        <button
          onClick={toggle}
          className="flex items-center justify-center w-full py-2 rounded-md transition-colors cursor-pointer hover:bg-white/5"
          style={{ color: 'var(--agni-text-muted)' }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
