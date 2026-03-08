import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Video, Activity, AlertTriangle, History } from 'lucide-react';
import { ROOMS, SENSOR_READINGS, SENSOR_TYPES, SENSOR_TRENDS, ALERTS, CAMERAS } from '@/data/mockData';
import StatusIndicator from '@/components/ui/StatusIndicator';
import SensorGauge from '@/components/rooms/SensorGauge';
import SensorChart from '@/components/dashboard/SensorChart';
import CameraFeed from '@/components/cctv/CameraFeed';
import AlertItem from '@/components/dashboard/AlertItem';
import HoverClue from '@/components/ui/HoverClue';

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  // Time filter state for Historical Charts
  const [timeRange, setTimeRange] = useState('1H');
  
  const room = ROOMS.find(r => r.id === id);
  const readings = SENSOR_READINGS[id] || {};
  const trends = SENSOR_TRENDS[id] || [];
  const alerts = ALERTS.filter(a => a.roomId === id);
  const camera = CAMERAS.find(c => c.roomId === id);

  // Derive filtered data simply based on range for UX demonstration
  const filteredTrends = useMemo(() => {
    if (timeRange === '1H') return trends;
    if (timeRange === '24H') return trends.filter((_, i) => i % 2 === 0); // show less granularity
    if (timeRange === '7D') return trends.filter((_, i) => i % 5 === 0);
    return trends.filter((_, i) => i % 10 === 0); // 30D
  }, [trends, timeRange]);

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--agni-text-primary)' }}>Room Not Found</h2>
        <button onClick={() => navigate('/rooms')} className="text-[var(--agni-amber)] hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Rooms
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: 'var(--agni-border)' }}>
        <div>
          <button 
            onClick={() => navigate('/rooms')}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-3 hover:text-[var(--agni-amber)] transition-colors"
            style={{ color: 'var(--agni-text-muted)' }}
          >
            <ArrowLeft className="w-3 h-3" /> Back to Facility
          </button>
          <div className="flex items-center gap-3">
            <StatusIndicator status={room.status} size="lg" />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--agni-text-primary)' }}>{room.name}</h1>
            
            {/* Sensor Status Pill */}
            {room.sensorStatus === 'offline' ? (
              <span className="flex items-center gap-1.5 text-xs text-red-600 font-bold px-2 py-1 rounded-md uppercase tracking-wider ml-2" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Offline
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold px-2 py-1 rounded-md uppercase tracking-wider ml-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Online
              </span>
            )}

            <span className="text-xs px-2 py-1 rounded font-mono mt-1" style={{ backgroundColor: 'var(--agni-bg-secondary)', color: 'var(--agni-text-secondary)' }}>
              Location: {room.floor}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-1" style={{ color: 'var(--agni-text-muted)' }}>
          <span className="text-xs uppercase tracking-wider">Last Sync</span>
          <div className="flex items-center gap-1.5 font-mono text-sm">
            <Clock className="w-4 h-4" />
            {new Date(room.lastUpdated).toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* ZONE A: REAL-TIME OVERVIEW */}
      <h2 className="text-sm font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: 'var(--agni-text-muted)' }}>Real-Time Overview</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Live Camera Feed (Priority 1) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {camera ? (
            <div className="flex flex-col rounded-xl overflow-hidden border-2" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: camera.hasDetection ? 'var(--agni-fire)' : 'var(--agni-border)' }}>
               <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--agni-border)' }}>
                 <div className="flex items-center gap-2">
                   <Video className="w-4 h-4" style={{ color: 'var(--agni-text-secondary)' }} />
                   <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-primary)' }}>Live Camera Feed</h2>
                 </div>
                 {camera.hasDetection && (
                   <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                     <AlertTriangle className="w-3 h-3" /> FLAME / ANOMALY DETECTED
                   </span>
                 )}
               </div>
               {/* 16:9 Aspect Ratio Wrapper for Camera */}
               <div className="relative w-full pb-[56.25%] bg-black">
                 <div className="absolute inset-0">
                    <CameraFeed camera={camera} />
                 </div>
               </div>
            </div>
          ) : (
             <div className="p-12 text-center border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-full" style={{ borderColor: 'var(--agni-border)', color: 'var(--agni-text-muted)', backgroundColor: 'var(--agni-bg-tertiary)' }}>
               <Video className="w-8 h-8 mb-2 opacity-50" />
               <p>No camera installed in this room.</p>
             </div>
          )}
        </div>

        {/* Current Readings (Priority 2) */}
        <div className="lg:col-span-2 border rounded-xl p-5 flex flex-col" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
          <div className="flex items-center justify-between mb-5">
             <div className="flex items-center gap-2">
               <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-primary)' }}>Current Readings</h3>
               <HoverClue text="Garis vertikal kecil menandakan batas aman. Jika bar melewati garis aman, warna berubah dan memicu peringatan." />
             </div>
          </div>
          
          <div className="space-y-6 flex-1">
            {SENSOR_TYPES.map(sensor => (
              <SensorGauge 
                key={sensor.key}
                type={sensor.label}
                value={readings[sensor.key] || 0}
                unit={sensor.unit}
                safeMax={sensor.safeMax}
                warnMax={sensor.warnMax}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ZONE B: HISTORICAL DATA */}
      <h2 className="text-sm font-bold uppercase tracking-wider mb-2 mt-8 pt-4 border-t" style={{ color: 'var(--agni-text-muted)', borderColor: 'var(--agni-border)' }}>Historical Data</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Historical Charts */}
        <div className="lg:col-span-3 border rounded-xl p-5 flex flex-col" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
           <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
             <div className="flex items-center gap-2">
               <Activity className="w-4 h-4" style={{ color: 'var(--agni-text-secondary)' }} />
               <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-primary)' }}>Sensor Trends</h2>
             </div>
             
             {/* Time Filter UI */}
             <div className="flex items-center rounded-md p-1 border" style={{ backgroundColor: 'var(--agni-bg-secondary)', borderColor: 'var(--agni-border)' }}>
               {['1H', '24H', '7D', '30D'].map(range => (
                 <button
                   key={range}
                   onClick={() => setTimeRange(range)}
                   className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                     timeRange === range 
                       ? 'shadow border'
                       : 'hover:text-[var(--agni-text-primary)]'
                   }`}
                   style={timeRange === range ? { 
                     backgroundColor: 'var(--agni-bg-primary)', 
                     borderColor: 'var(--agni-border)', 
                     color: 'var(--agni-text-primary)' 
                   } : { color: 'var(--agni-text-muted)' }}
                 >
                   {range}
                 </button>
               ))}
             </div>
           </div>
           
           <div className="flex-1 mt-2">
             <SensorChart data={filteredTrends} sensors={['flame', 'smoke', 'co']} height={300} />
           </div>
        </div>

        {/* Alert History */}
        <div className="lg:col-span-2 border rounded-xl flex flex-col overflow-hidden h-full" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)', minHeight: '300px' }}>
           <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--agni-border)', backgroundColor: 'var(--agni-bg-secondary)' }}>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" style={{ color: 'var(--agni-text-secondary)' }} />
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-primary)' }}>Alert History</h3>
              </div>
              <span className="text-xs font-mono px-2 rounded-full" style={{ backgroundColor: 'var(--agni-bg-primary)', color: 'var(--agni-text-muted)' }}>{alerts.length}</span>
           </div>
           <div className="p-3 space-y-3 overflow-y-auto flex-1 h-[300px]">
              {alerts.length > 0 ? (
                alerts.map(a => (
                  <div key={a.id} className="p-1 rounded-md border" style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)' }}>
                     <AlertItem alert={a} compact />
                  </div>
                ))
              ) : (
                <div className="py-8 text-center h-full flex flex-col items-center justify-center font-medium" style={{ color: 'var(--agni-text-muted)' }}>
                  <History className="w-8 h-8 mb-2 opacity-30" />
                  No historical API logs.
                </div>
              )}
           </div>
        </div>

      </div>
    </div>
  );
}
