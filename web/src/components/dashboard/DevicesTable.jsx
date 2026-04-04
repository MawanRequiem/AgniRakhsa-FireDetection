import { Cpu, SignalHigh, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import { useRoomsStore } from '@/stores/useRoomsStore';

export default function DevicesTable({ devices, isLoading }) {
  const rooms = useRoomsStore((state) => state.rooms);

  if (isLoading && (!devices || devices.length === 0)) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-8 text-center bg-[var(--agni-bg-tertiary)] border border-[var(--agni-border)]">
        <Cpu className="mb-2 h-8 w-8 text-muted-foreground/50 opacity-80 animate-pulse" />
        <p className="text-xs tracking-wider uppercase font-mono text-muted-foreground">SCANNING_DEVICES...</p>
      </div>
    );
  }

  if (!devices || devices.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center p-8 text-center bg-[var(--agni-bg-tertiary)] border border-dashed border-[var(--agni-border)]">
        <WifiOff className="mb-2 h-8 w-8 text-muted-foreground/30 opacity-80" />
        <p className="text-sm font-semibold tracking-wider uppercase text-muted-foreground">NO SENSORS PROVISIONED</p>
        <p className="text-[10px] text-muted-foreground/70 font-mono mt-1 uppercase">AWAITING_FIRMWARE_HANDSHAKE</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[var(--agni-border)] card-shadow bg-[var(--agni-bg-primary)]">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-[var(--agni-bg-secondary)] border-b border-[var(--agni-border)] text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Node Location</th>
            <th className="px-4 py-3 font-medium">MAC Address</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Last Heartbeat</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--agni-border)] font-mono text-xs">
          {devices.map((device, idx) => {
            const isOnline = device.status === 'online';
            const hbDate = new Date(device.last_seen);
            
            const room = rooms.find(r => r.id === device.room_id);
            const roomName = room ? room.name : 'UNASSIGNED';
            
            return (
              <motion.tr 
                key={device.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="hover:bg-[var(--agni-bg-tertiary)] transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {roomName}
                  <span className="text-muted-foreground block text-[9px] mt-0.5">
                    ID: {device.id.split('-')[0].toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 opacity-80">
                  {device.mac_address || 'UNKNOWN MAC'}
                </td>
                <td className="px-4 py-3">
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] font-sans font-bold uppercase tracking-wider">
                      <SignalHigh className="w-3 h-3" />
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/20 text-muted-foreground border border-[var(--agni-border)] text-[10px] font-sans font-bold uppercase tracking-wider">
                      <WifiOff className="w-3 h-3" />
                      Offline
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right opacity-70">
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
