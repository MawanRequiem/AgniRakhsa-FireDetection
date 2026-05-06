import { Cpu, SignalHigh, WifiOff, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { useDashboardStore } from '@/stores/useDashboardStore';

export default function DevicesTable({ devices, isLoading }) {
  const rooms = useRoomsStore((state) => state.rooms);
  const sensorHealth = useDashboardStore((state) => state.sensorHealth);

  if (isLoading && (!devices || devices.length === 0)) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-8 text-center" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
        <Cpu className="mb-2 h-8 w-8 opacity-30 animate-pulse" style={{ color: 'var(--ifrit-text-muted)' }} />
        <p className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>Scanning for devices...</p>
      </div>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-8 text-center border-t border-dashed" style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-muted)' }}>
        <WifiOff className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-sm font-medium">No sensors provisioned</p>
        <p className="text-xs mt-1 opacity-60">Devices register automatically when firmware boots</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="border-b text-xs font-medium" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-muted)' }}>
          <tr>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">MAC Address</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Last Heartbeat</th>
          </tr>
        </thead>
        <tbody className="divide-y font-mono text-xs" style={{ borderColor: 'var(--ifrit-border)' }}>
          {devices.map((device, idx) => {
            const isOnline = device.status === 'online' || device.status === 'calibrating';
            const isCalibrating = device.status === 'calibrating';
            const hbDate = new Date(device.last_seen);
            
            const room = rooms.find(r => r.id === device.room_id);
            const roomName = room ? room.name : 'Unassigned';
            
            const deviceSensors = sensorHealth?.sensors?.filter(s => s.device_id === device.id) || [];
            const unhealthySensors = deviceSensors.filter(s => s.status !== 'healthy');
            const hasUnhealthy = unhealthySensors.length > 0;
            
            return (
              <motion.tr 
                key={device.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="hover:bg-[var(--ifrit-bg-secondary)] transition-colors"
                style={{ borderColor: 'var(--ifrit-border)' }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--ifrit-text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  <div className="flex items-center gap-2">
                    {roomName}
                    {hasUnhealthy && (
                      <span title={unhealthySensors.map(s => `${s.sensor_type}: ${s.status}`).join('\n')} className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500/20 text-red-500 text-[10px] cursor-help">
                        !
                      </span>
                    )}
                  </div>
                  <span className="block text-[10px] mt-0.5" style={{ color: 'var(--ifrit-text-muted)' }}>
                    {device.name || 'Sensor Node'}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--ifrit-text-secondary)' }}>
                  {device.mac_address || '—'}
                </td>
                <td className="px-4 py-3">
                  {isCalibrating ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', color: 'var(--ifrit-info)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Calibrating
                    </span>
                  ) : isOnline ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', color: 'var(--ifrit-safe)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <SignalHigh className="w-3 h-3" />
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                      style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', color: 'var(--ifrit-text-muted)', border: '1px solid var(--ifrit-border)' }}>
                      <WifiOff className="w-3 h-3" />
                      Offline
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" style={{ color: 'var(--ifrit-text-muted)' }}>
                  {hbDate.toLocaleTimeString([], { hour12: false })}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

DevicesTable.propTypes = {
  devices: PropTypes.array,
  isLoading: PropTypes.bool
};
