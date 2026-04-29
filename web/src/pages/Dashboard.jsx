import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Activity, BellRing, Route, HardDrive, Thermometer, Wind } from 'lucide-react';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import MetricCard from '@/components/dashboard/MetricCard';
import AlertFeed from '@/components/dashboard/AlertFeed';
import SensorsOverview from '@/components/dashboard/SensorsOverview';
import NodeCard from '@/components/dashboard/NodeCard';

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
    fetchSensorHealth,
    connectWebSocket,
    disconnectWebSocket,
    isConnected,
    latestReadings,
    sensorHealth
  } = useDashboardStore();

  const { rooms, fetchRooms } = useRoomsStore();

  useEffect(() => {
    fetchSummary();
    fetchRecentAlerts();
    fetchDevices();
    fetchSensorHistory();
    fetchSensorHealth();
    fetchRooms();
    connectWebSocket();

    const statusPoll = setInterval(() => {
      if (!document.hidden) {
        fetchDevices();
        fetchSummary();
        fetchSensorHealth();
      }
    }, 15000);

    return () => {
      disconnectWebSocket();
      clearInterval(statusPoll);
    };
  }, [fetchSummary, fetchRecentAlerts, fetchDevices, fetchSensorHistory, fetchSensorHealth, fetchRooms, connectWebSocket, disconnectWebSocket]);

  const getRoomName = (roomId) => {
    if (!roomId) return 'Unassigned';
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : 'Unknown';
  };

  const getNodeRoomName = (deviceId) => {
    if (!deviceId) return '';
    const device = devices.find(d => d.id === deviceId);
    return getRoomName(device?.room_id);
  };

  // Analytics Computations
  let maxTemp = -Infinity;
  let maxTempNodeId = null;
  let maxGas = -Infinity;
  let maxGasNodeId = null;

  Object.entries(latestReadings || {}).forEach(([deviceId, readings]) => {
    if (readings.SHTC3_TEMP !== undefined && readings.SHTC3_TEMP > maxTemp) {
      maxTemp = readings.SHTC3_TEMP;
      maxTempNodeId = deviceId;
    }
    const gasKeys = ['MQ2', 'MQ4', 'MQ5', 'MQ6', 'MQ7', 'MQ9B', 'MQ135'];
    gasKeys.forEach(k => {
      if (readings[k] !== undefined && readings[k] > maxGas) {
        maxGas = readings[k];
        maxGasNodeId = deviceId;
      }
    });
  });

  let statusValue = "All Systems Safe";
  let statusSubtext = "Monitoring active — no threats";
  let statusColor = "green";
  let StatusIcon = Activity;

  if (summary.activeAlerts > 0) {
    statusValue = "Critical Alerts";
    statusSubtext = `${summary.activeAlerts} alerts need attention`;
    statusColor = "red";
    StatusIcon = BellRing;
  } else if (summary.highRiskRooms > 0) {
    statusValue = "Hazard Detected";
    statusSubtext = `${summary.highRiskRooms} zones at high risk`;
    statusColor = "red";
    StatusIcon = Route;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end mb-2 border-b pb-4" style={{ borderColor: 'var(--ifrit-border)' }}>
        <div>
           <div className="flex items-center gap-3">
             <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ifrit-text-primary)' }}>
               Facility Dashboard
             </h2>
             {isConnected ? (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                 <span className="text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">Connected</span>
               </div>
             ) : (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                 <span className="text-[10px] font-semibold tracking-wider text-red-600 dark:text-red-400">Disconnected</span>
               </div>
             )}
           </div>
           <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>Monitoring all areas for fire and gas threats</p>
        </div>
      </div>
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Facility Status" 
          value={isLoading ? '-' : statusValue} 
          subtext={statusSubtext}
          icon={StatusIcon} 
          color={statusColor}
        />
        <MetricCard 
          title="Highest Temperature" 
          value={maxTemp > -Infinity ? `${maxTemp.toFixed(1)}°C` : '—'} 
          subtext={maxTempNodeId ? `Zone: ${getNodeRoomName(maxTempNodeId)}` : 'Awaiting Data'}
          icon={Thermometer} 
          color={maxTemp > 35 ? "red" : "default"} 
        />
        <MetricCard 
          title="Highest Gas Level" 
          value={maxGas > -Infinity ? `${maxGas.toFixed(0)} ppm` : '—'} 
          subtext={maxGasNodeId ? `Zone: ${getNodeRoomName(maxGasNodeId)}` : 'Awaiting Data'}
          icon={Wind} 
          color={maxGas > 800 ? "red" : "default"}
        />
        <MetricCard 
          title="Network Health" 
          value={isLoading ? '-' : `${summary.onlineDevices} / ${devices.length} Online`} 
          subtext={(() => {
            const unhealthyCount = sensorHealth?.sensors?.filter(s => s.status !== 'healthy')?.length || 0;
            return unhealthyCount > 0 
              ? <span className="text-red-500 font-medium">{unhealthyCount} sensors require attention</span>
              : "All devices and sensors operational";
          })()}
          icon={HardDrive} 
          color={summary.onlineDevices < devices.length || (sensorHealth?.sensors?.filter(s => s.status !== 'healthy')?.length > 0) ? "red" : "blue"} 
        />
      </div>

      {/* Middle Section: Chart & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 border rounded-lg overflow-hidden"
          style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-primary)' }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Real-time Activity</h3>
              <select 
                className="text-xs p-1.5 pr-6 rounded-md border outline-none cursor-pointer"
                style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}
              >
                <option value="ALL">Average (All Areas)</option>
                {devices?.map((d) => (
                  <option key={d.id} value={d.id}>Node: {getRoomName(d.room_id)}</option>
                ))}
              </select>
            </div>
            {/* Dynamic Legend rendered inside SensorsOverview */}
          </div>
          <div className="p-4">
            <SensorsOverview />
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 flex flex-col h-full border rounded-lg overflow-hidden"
          style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-primary)' }}
        >
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Recent Activity</h3>
            <button 
              onClick={() => navigate('/alerts')}
              className="text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--ifrit-brand)' }}
            >
              View all →
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
            {isLoading && recentAlerts.length === 0 ? (
              <div className="animate-pulse space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="h-14 w-full rounded-md" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)' }} />
                ))}
              </div>
            ) : (
              <AlertFeed alerts={recentAlerts} />
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Section: Active Devices Table */}
      {/* Bottom Section: Active Nodes Grid */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" style={{ color: 'var(--ifrit-text-muted)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Live Device Status</h3>
          </div>
          <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>{devices.length} nodes registered</span>
        </div>
        
        {isLoading && devices.length === 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
             {[1,2,3,4].map(i => (
               <div key={i} className="h-64 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }} />
             ))}
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {devices.map((device) => (
              <NodeCard 
                key={device.id} 
                device={device} 
                roomName={getRoomName(device.room_id)} 
                latestReadings={latestReadings[device.id] || {}}
              />
            ))}
            {devices.length === 0 && (
              <div className="col-span-full py-12 text-center border rounded-lg" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-primary)' }}>
                <HardDrive className="w-8 h-8 mx-auto mb-3 opacity-20" />
                <p className="text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>No sensor nodes provisioned.</p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
