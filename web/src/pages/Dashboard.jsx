import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, Activity, BellRing, Route, HardDrive, Thermometer, Wind } from 'lucide-react';

import { useDashboardStore } from '@/stores/useDashboardStore';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { useUIStore } from '@/store/store';
import MetricCard from '@/components/dashboard/MetricCard';
import AlertFeed from '@/components/dashboard/AlertFeed';
import SensorsOverview from '@/components/dashboard/SensorsOverview';
import NodeCard from '@/components/dashboard/NodeCard';
import { SkeletonCard } from '@/components/ui/skeleton';

export default function Dashboard() {
  const navigate = useNavigate();
  const language = useUIStore((s) => s.language);
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

  const [selectedDevice, setSelectedDevice] = useState('ALL');
  const [timeRange, setTimeRange] = useState('1H');

  const minutesMap = { '1H': 60, '24H': 1440, '7D': 10080, '30D': 43200 };

  useEffect(() => {
    const mins = minutesMap[timeRange] || 60;
    fetchSensorHistory(selectedDevice, mins);
  }, [selectedDevice, timeRange, fetchSensorHistory]);

  useEffect(() => {
    fetchSummary();
    fetchRecentAlerts();
    fetchDevices();
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
  }, [fetchSummary, fetchRecentAlerts, fetchDevices, fetchSensorHealth, fetchRooms, connectWebSocket, disconnectWebSocket]);

  const getRoomName = (roomId) => {
    if (!roomId) return language === 'en' ? 'Unassigned' : 'Belum Ditetapkan';
    const room = rooms.find(r => r.id === roomId);
    return room ? room.name : (language === 'en' ? 'Unknown' : 'Tidak Diketahui');
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

  let statusValue = language === 'en' ? "All Areas Safe" : "Semua Area Aman";
  let statusSubtext = language === 'en' ? "Monitoring active - no threats" : "Pemantauan aktif - tidak ada ancaman";
  let statusColor = "green";
  let StatusIcon = Activity;

  const roomStatus = summary.room_status_counts || {};
  const criticalRooms = roomStatus.critical || 0;

  if (summary.activeAlerts > 0) {
    statusValue = language === 'en' ? "Fire Hazard!" : "Bahaya Kebakaran!";
    statusSubtext = language === 'en' 
      ? `${summary.activeAlerts} active alert(s) require immediate action` 
      : `${summary.activeAlerts} peringatan aktif memerlukan tindakan segera`;
    statusColor = "red";
    StatusIcon = BellRing;
  } else if (criticalRooms > 0) {
    statusValue = language === 'en' ? "Critical Status" : "Status Kritis";
    statusSubtext = language === 'en' 
      ? `${criticalRooms} room(s) in danger condition` 
      : `${criticalRooms} ruangan dalam kondisi bahaya`;
    statusColor = "red";
    StatusIcon = BellRing;
  } else if (summary.highRiskRooms > 0) {
    statusValue = language === 'en' ? "Threat Detected" : "Ancaman Terdeteksi";
    statusSubtext = language === 'en' 
      ? `${summary.highRiskRooms} high risk room(s)` 
      : `${summary.highRiskRooms} ruangan berisiko tinggi`;
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
               {language === 'en' ? 'Facility Monitoring' : 'Pemantauan Fasilitas'}
             </h2>
             {isConnected ? (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                 <span className="text-[10px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400">
                   {language === 'en' ? 'Connected' : 'Terhubung'}
                 </span>
               </div>
             ) : (
               <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                 <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                 <span className="text-[10px] font-semibold tracking-wider text-red-600 dark:text-red-400">
                   {language === 'en' ? 'Disconnected' : 'Terputus'}
                 </span>
               </div>
             )}
           </div>
           <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>
             {language === 'en' ? 'Monitoring all areas for fire and smoke hazards' : 'Memantau semua area dari bahaya kebakaran dan asap'}
           </p>
         </div>
      </div>
      
      {/* Top Stats Row */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <SkeletonCard key={i} hasHeader lines={1} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            title={language === 'en' ? 'Facility Status' : 'Status Fasilitas'} 
            value={statusValue} 
            subtext={statusSubtext}
            icon={StatusIcon} 
            color={statusColor}
          />
          <MetricCard 
            title={language === 'en' ? 'Highest Temperature' : 'Suhu Tertinggi'} 
            value={maxTemp > -Infinity ? `${maxTemp.toFixed(1)}°C` : '-'} 
            subtext={maxTempNodeId 
              ? `${language === 'en' ? 'Room' : 'Ruangan'}: ${getNodeRoomName(maxTempNodeId)}` 
              : (language === 'en' ? 'Waiting for Data' : 'Menunggu Data')}
            icon={Thermometer} 
            color={maxTemp > 35 ? "red" : "default"} 
          />
          <MetricCard 
            title={language === 'en' ? 'Highest Gas Level' : 'Kadar Gas Tertinggi'} 
            value={maxGas > -Infinity ? `${maxGas.toFixed(0)} ppm` : '-'} 
            subtext={maxGasNodeId 
              ? `${language === 'en' ? 'Room' : 'Ruangan'}: ${getNodeRoomName(maxGasNodeId)}` 
              : (language === 'en' ? 'Waiting for Data' : 'Menunggu Data')}
            icon={Wind} 
            color={maxGas > 800 ? "red" : "default"}
          />
          <MetricCard 
            title={language === 'en' ? 'Device Health' : 'Kesehatan Perangkat'} 
            value={`${summary.onlineDevices} / ${devices.length} ${language === 'en' ? 'Active' : 'Aktif'}`} 
            subtext={(() => {
              const unhealthyCount = sensorHealth?.sensors?.filter(s => s.status !== 'healthy')?.length || 0;
              return unhealthyCount > 0 
                ? <span className="text-red-500 font-medium">
                    {unhealthyCount} {language === 'en' ? 'sensor(s) need inspection' : 'sensor perlu diperiksa'}
                  </span>
                : (language === 'en' ? 'All devices and sensors healthy' : 'Semua perangkat dan sensor normal');
            })()}
            icon={HardDrive} 
            color={summary.onlineDevices < devices.length || (sensorHealth?.sensors?.filter(s => s.status !== 'healthy')?.length > 0) ? "red" : "blue"} 
          />
        </div>
      )}

      {/* Middle Section: Chart & Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 lg:h-[360px] flex flex-col border rounded-lg overflow-hidden"
          style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-primary)' }}
        >
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {language === 'en' ? 'Monitoring Chart' : 'Grafik Pemantauan'}
              </h3>
              <select 
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="text-xs p-1.5 pr-6 rounded-md border outline-none cursor-pointer"
                style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}
              >
                <option value="ALL">
                  {language === 'en' ? 'Average of All Areas' : 'Rata-rata Semua Area'}
                </option>
                {devices?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {language === 'en' ? 'Sensor' : 'Sensor'}: {getRoomName(d.room_id)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Time Range Filter */}
            <div className="flex items-center rounded-md p-0.5 border" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
              {['1H', '24H', '7D', '30D'].map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors cursor-pointer ${
                    timeRange === range 
                      ? 'shadow border font-bold'
                      : 'hover:text-[var(--ifrit-text-primary)]'
                  }`}
                  style={timeRange === range ? { 
                    backgroundColor: 'var(--ifrit-bg-primary)', 
                    borderColor: 'var(--ifrit-border)', 
                    color: 'var(--ifrit-text-primary)' 
                  } : { color: 'var(--ifrit-text-muted)' }}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 flex-1 min-h-0 relative flex flex-col justify-center">
            <SensorsOverview timeRange={timeRange} />
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-1 lg:h-[360px] flex flex-col border rounded-lg overflow-hidden"
          style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-primary)' }}
        >
          <div className="flex items-center justify-between p-4 border-b flex-shrink-0" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
              {language === 'en' ? 'Recent Activity' : 'Aktivitas Terkini'}
            </h3>
            <button 
              onClick={() => navigate('/dashboard/alerts')}
              className="text-xs font-medium transition-opacity hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--ifrit-brand)' }}
            >
              {language === 'en' ? 'View all →' : 'Lihat semua →'}
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar min-h-0" style={{ backgroundColor: 'var(--ifrit-bg-primary)' }}>
            {isLoading && recentAlerts.length === 0 ? (
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <SkeletonCard key={i} lines={2} className="h-14" />
                ))}
              </div>
            ) : (
              <AlertFeed alerts={recentAlerts} />
            )}
          </div>
        </motion.div>
      </div>

      {/* Bottom Section: Active Nodes Grid */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" style={{ color: 'var(--ifrit-text-muted)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
              {language === 'en' ? 'Active Sensor Status' : 'Status Sensor Aktif'}
            </h3>
          </div>
          <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
            {devices.length} {language === 'en' ? 'registered sensor(s)' : 'sensor terdaftar'}
          </span>
        </div>
        
        {isLoading && devices.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <SkeletonCard key={i} hasHeader lines={3} className="h-64" />
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
                <p className="text-sm" style={{ color: 'var(--ifrit-text-muted)' }}>
                  {language === 'en' ? 'No registered sensors yet.' : 'Belum ada sensor terdaftar.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}



