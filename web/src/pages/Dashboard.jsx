import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Activity, BellRing, Route, HardDrive } from 'lucide-react';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import MetricCard from '@/components/dashboard/MetricCard';
import AlertFeed from '@/components/dashboard/AlertFeed';
import SensorsOverview from '@/components/dashboard/SensorsOverview';
import DevicesTable from '@/components/dashboard/DevicesTable';
import HoverClue from '@/components/ui/HoverClue';

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    summary, 
    recentAlerts, 
    devices,
    isLoading, 
    fetchSummary,
    fetchRecentAlerts,
    fetchDevices,
    fetchSensorHistory,
    connectWebSocket,
    disconnectWebSocket,
    isConnected
  } = useDashboardStore();

  const { rooms, fetchRooms } = useRoomsStore();

  // Load initial data and connect to websocket
  useEffect(() => {
    fetchSummary();
    fetchRecentAlerts();
    fetchDevices();
    fetchSensorHistory();
    fetchRooms();
    connectWebSocket();

    return () => {
      disconnectWebSocket();
    };
  }, [fetchSummary, fetchRecentAlerts, fetchDevices, fetchSensorHistory, fetchRooms, connectWebSocket, disconnectWebSocket]);

  const getRoomName = (roomId) => {
    if (!roomId) return 'UNASSIGNED';
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : roomId.split('-')[0].toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4 border-b border-[var(--agni-border)] pb-4">
        <div>
           <div className="flex items-center gap-4">
             <h2 className="text-2xl font-bold tracking-tight text-foreground uppercase">
               SYSTEM_MONITOR
             </h2>
             {isConnected ? (
               <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-green-500/10 border border-green-500/50">
                 <div className="w-1.5 h-1.5 bg-green-500 animate-pulse" />
                 <span className="text-[10px] uppercase font-bold tracking-wider text-green-600 dark:text-green-400 font-mono">CONNECTION_SECURE</span>
               </div>
             ) : (
               <div className="flex items-center gap-2 px-2.5 py-1 rounded-sm bg-red-500/10 border border-red-500/50">
                 <div className="w-1.5 h-1.5 bg-red-500" />
                 <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 dark:text-red-400 font-mono">CONNECTION_LOST</span>
               </div>
             )}
           </div>
           <p className="text-xs uppercase tracking-widest mt-1 text-muted-foreground font-mono opacity-80">MULTI-MCU TELEMETRY NODE</p>
        </div>
      </div>
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Monitored Zones" 
          value={isLoading ? '-' : summary.totalRooms} 
          icon={Building2} 
          color="blue"
        />
        <MetricCard 
          title="Online Sensors" 
          value={isLoading ? '-' : summary.onlineDevices} 
          icon={Activity} 
          color="green" 
        />
        <MetricCard 
          title="High Risk Zones" 
          value={isLoading ? '-' : summary.highRiskRooms} 
          icon={Route} 
          color={summary.highRiskRooms > 0 ? "red" : "amber"}
        />
        <MetricCard 
          title="Active Alerts" 
          value={isLoading ? '-' : summary.activeAlerts} 
          icon={BellRing} 
          color={summary.activeAlerts > 0 ? "red" : "blue"} 
        />
      </div>

      {/* Middle Section: Chart & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 shadow-sm border border-[var(--agni-border)] bg-[var(--agni-bg-primary)] p-0"
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--agni-border)] bg-[var(--agni-bg-secondary)]">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider">Telemetry Readout</h3>
              <select className="bg-[var(--agni-bg-tertiary)] border border-[var(--agni-border)] text-[10px] text-muted-foreground focus:text-foreground p-1 pr-6 font-mono font-bold tracking-wider uppercase outline-none focus:border-[#f59e0b] transition-colors appearance-none cursor-pointer">
                <option value="ALL">AVERAGE_ALL_NODES</option>
                {devices?.map((d) => (
                  <option key={d.id} value={d.id}>NODE: {getRoomName(d.room_id)}</option>
                ))}
              </select>
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-4 font-mono font-bold uppercase">
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-[#f59e0b]/80" /> TEMP_C</div>
               <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-[#ef4444]/80" /> GAS_PPM</div>
            </div>
          </div>
          <div className="p-4">
            <SensorsOverview />
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 flex flex-col h-full border border-[var(--agni-border)] bg-[var(--agni-bg-primary)] shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--agni-border)] bg-[var(--agni-bg-secondary)]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Incident Log</h3>
            <button 
              onClick={() => navigate('/alerts')}
              className="text-[10px] uppercase font-bold tracking-widest text-[#f59e0b] hover:opacity-80 transition-opacity"
            >
              [ View Log ]
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[var(--agni-bg-primary)]">
            {isLoading && recentAlerts.length === 0 ? (
              <div className="animate-pulse space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-14 w-full bg-[var(--agni-bg-tertiary)] border border-[var(--agni-border)]" />
                ))}
              </div>
            ) : (
              <AlertFeed alerts={recentAlerts} />
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Section: Active Devices Table */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="w-full flex flex-col border border-[var(--agni-border)] bg-[var(--agni-bg-primary)] shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--agni-border)] bg-[var(--agni-bg-secondary)]">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 opacity-70" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">MCU Fleet Status</h3>
          </div>
          <span className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">TOTAL_NODES: {devices.length}</span>
        </div>
        <DevicesTable devices={devices} isLoading={isLoading} />
      </motion.div>

    </div>
  );
}
