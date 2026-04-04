import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Video, Activity, AlertTriangle, History } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';
import SensorGauge from '@/components/rooms/SensorGauge';
import SensorChart from '@/components/dashboard/SensorChart';
import CameraFeed from '@/components/cctv/CameraFeed';
import HoverClue from '@/components/ui/HoverClue';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { customFetch } from '@/lib/api';

// Sensor type display configuration
const SENSOR_DISPLAY = [
  { key: 'MQ2', label: 'MQ2 (Smoke)', unit: 'ppm', safeMax: 400, warnMax: 800 },
  { key: 'MQ4', label: 'MQ4 (CNG)', unit: 'ppm', safeMax: 400, warnMax: 800 },
  { key: 'MQ6', label: 'MQ6 (LPG)', unit: 'ppm', safeMax: 400, warnMax: 800 },
  { key: 'MQ9B', label: 'MQ9B (CO)', unit: 'ppm', safeMax: 400, warnMax: 800 },
  { key: 'FLAME', label: 'Flame IR', unit: 'raw', safeMax: 3000, warnMax: 1500 },
  { key: 'SHTC3_TEMP', label: 'Temperature', unit: '°C', safeMax: 35, warnMax: 50 },
  { key: 'SHTC3_HUMIDITY', label: 'Humidity', unit: '%', safeMax: 70, warnMax: 85 },
];

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedRoom, isLoading, fetchRoomDetail, clearSelectedRoom } = useRoomsStore();
  
  const [timeRange, setTimeRange] = useState('1H');
  const [sensorReadings, setSensorReadings] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [cameras, setCameras] = useState([]);

  // Fetch room detail on mount
  useEffect(() => {
    fetchRoomDetail(id);
    return () => clearSelectedRoom();
  }, [id, fetchRoomDetail, clearSelectedRoom]);

  // Fetch sensor current values from room's devices
  useEffect(() => {
    if (!selectedRoom?.devices?.length) return;
    
    const fetchSensorData = async () => {
      try {
        const response = await customFetch(`/api/v1/sensors/?room_id=${id}`);
        if (response.ok) {
          const sensors = await response.json();
          const readings = {};
          for (const s of sensors) {
            readings[s.sensor_type] = s.current_value || 0;
          }
          setSensorReadings(readings);
        }
      } catch (err) {
        console.error('Failed to fetch sensor data:', err);
      }
    };
    fetchSensorData();
    // Poll every 5 seconds for updated readings
    const interval = setInterval(fetchSensorData, 5000);
    return () => clearInterval(interval);
  }, [id, selectedRoom?.devices?.length]);

  // Fetch sensor history for trend charts
  useEffect(() => {
    const minutesMap = { '1H': 60, '24H': 1440, '7D': 1440, '30D': 1440 };
    const fetchHistory = async () => {
      try {
        const params = new URLSearchParams({
          room_id: id,
          minutes: String(minutesMap[timeRange] || 60),
        });
        const response = await customFetch(`/api/v1/sensors/history?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setTrendData(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch sensor history:', err);
      }
    };
    fetchHistory();
  }, [id, timeRange]);

  // Fetch cameras for this room
  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const response = await customFetch(`/api/v1/cameras/?room_id=${id}`);
        if (response.ok) {
          const data = await response.json();
          setCameras(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch cameras:', err);
      }
    };
    fetchCameras();
  }, [id]);

  if (isLoading && !selectedRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--agni-amber)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono" style={{ color: 'var(--agni-text-muted)' }}>LOADING ROOM DATA...</p>
      </div>
    );
  }

  if (!selectedRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--agni-text-primary)' }}>Room Not Found</h2>
        <button onClick={() => navigate('/rooms')} className="text-[var(--agni-amber)] hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Rooms
        </button>
      </div>
    );
  }

  const room = selectedRoom;
  const camera = cameras.length > 0 ? cameras[0] : null;
  const alerts = room.active_alerts || [];
  const availableSensors = SENSOR_DISPLAY.filter(s => sensorReadings[s.key] !== undefined);

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
            <StatusIndicator status={room.status === 'critical' ? 'fire' : room.status} size="lg" />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--agni-text-primary)' }}>{room.name}</h1>
            
            <span className="text-xs px-2 py-1 rounded font-mono mt-1" style={{ backgroundColor: 'var(--agni-bg-secondary)', color: 'var(--agni-text-secondary)' }}>
              Location: {room.floor || room.building_name || '—'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-1" style={{ color: 'var(--agni-text-muted)' }}>
          <span className="text-xs uppercase tracking-wider">Devices: {room.devices?.length || 0} | Sensors: {room.sensor_count || 0}</span>
          <div className="flex items-center gap-1.5 font-mono text-sm">
            <Clock className="w-4 h-4" />
            {new Date(room.created_at).toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* ZONE A: REAL-TIME OVERVIEW */}
      <h2 className="text-sm font-bold uppercase tracking-wider mb-2 mt-4" style={{ color: 'var(--agni-text-muted)' }}>Real-Time Overview</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Live Camera Feed */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {camera ? (
            <div className="flex flex-col rounded-xl overflow-hidden border-2" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: camera.has_detection ? 'var(--agni-fire)' : 'var(--agni-border)' }}>
               <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--agni-border)' }}>
                 <div className="flex items-center gap-2">
                   <Video className="w-4 h-4" style={{ color: 'var(--agni-text-secondary)' }} />
                   <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-primary)' }}>Live Camera Feed</h2>
                 </div>
                 {camera.has_detection && (
                   <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                     <AlertTriangle className="w-3 h-3" /> FLAME / ANOMALY DETECTED
                   </span>
                 )}
               </div>
               <div className="relative w-full pb-[56.25%] bg-black">
                 <div className="absolute inset-0">
                    <CameraFeed camera={camera} />
                 </div>
               </div>
            </div>
          ) : (
             <div className="p-12 text-center border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-full" style={{ borderColor: 'var(--agni-border)', color: 'var(--agni-text-muted)', backgroundColor: 'var(--agni-bg-tertiary)' }}>
               <Video className="w-8 h-8 mb-2 opacity-50" />
               <p>No camera provisioned for this room.</p>
               <p className="text-[10px] font-mono mt-1 opacity-50">Configure via /api/v1/cameras/</p>
             </div>
          )}
        </div>

        {/* Current Readings */}
        <div className="lg:col-span-2 border rounded-xl p-5 flex flex-col" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
          <div className="flex items-center justify-between mb-5">
             <div className="flex items-center gap-2">
               <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--agni-text-primary)' }}>Current Readings</h3>
               <HoverClue text="Garis vertikal kecil menandakan batas aman. Jika bar melewati garis aman, warna berubah dan memicu peringatan." />
             </div>
          </div>
          
          <div className="space-y-6 flex-1">
            {availableSensors.length > 0 ? (
              availableSensors.map(sensor => (
                <SensorGauge 
                  key={sensor.key}
                  type={sensor.label}
                  value={sensorReadings[sensor.key] || 0}
                  unit={sensor.unit}
                  safeMax={sensor.safeMax}
                  warnMax={sensor.warnMax}
                />
              ))
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--agni-text-muted)' }}>
                <p className="text-xs font-mono">NO SENSOR DATA AVAILABLE</p>
              </div>
            )}
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
             {trendData.length > 0 ? (
               <SensorChart data={trendData} sensors={Object.keys(trendData[0]).filter(k => k !== 'time')} height={300} />
             ) : (
               <div className="h-[300px] flex items-center justify-center" style={{ color: 'var(--agni-text-muted)' }}>
                 <p className="text-xs font-mono">NO HISTORICAL DATA IN WINDOW</p>
               </div>
             )}
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
                  <div key={a.id} className="p-3 rounded-md border" style={{ backgroundColor: 'var(--agni-bg-primary)', borderColor: 'var(--agni-border)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIndicator status={a.severity === 'critical' ? 'fire' : 'warning'} size="sm" />
                      <span className="text-xs font-medium" style={{ color: 'var(--agni-text-primary)' }}>{a.alert_type || 'Alert'}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--agni-text-secondary)' }}>{a.message}</p>
                    <span className="text-[10px] font-mono mt-1 block" style={{ color: 'var(--agni-text-muted)' }}>
                      {new Date(a.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center h-full flex flex-col items-center justify-center font-medium" style={{ color: 'var(--agni-text-muted)' }}>
                  <History className="w-8 h-8 mb-2 opacity-30" />
                  No active alerts for this room.
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
