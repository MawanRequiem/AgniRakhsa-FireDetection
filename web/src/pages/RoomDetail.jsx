import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Video, Activity, AlertTriangle, History, Thermometer, Droplets, Flame, Wind } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';
import SensorChart from '@/components/dashboard/SensorChart';
import CameraFeed from '@/components/cctv/CameraFeed';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { customFetch } from '@/lib/api';
import { useDashboardStore } from '@/stores/useDashboardStore';

const SENSOR_CONFIG = {
  SHTC3_TEMP: { label: 'Temperature', unit: '°C', type: 'env', max: 50 },
  SHTC3_HUMIDITY: { label: 'Humidity', unit: '%', type: 'env', max: 100 },
  FLAME: { label: 'Flame (IR)', unit: 'raw', type: 'fire', max: 4095 },
  MQ2: { label: 'MQ-2 (Smoke/LPG)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ4: { label: 'MQ-4 (Methane)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ5: { label: 'MQ-5 (Natural Gas)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ6: { label: 'MQ-6 (LPG)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ7: { label: 'MQ-7 (CO)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ9B: { label: 'MQ-9B (CO/Methane)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ135: { label: 'MQ-135 (Air Quality)', unit: 'ppm', type: 'gas', max: 4095 },
};

function SensorBar({ label, value, unit, type }) {
  const config = Object.values(SENSOR_CONFIG).find(c => c.label === label);
  const max = config ? config.max : 4095;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  
  let colorClass = "bg-[var(--ifrit-brand)]";
  if (type === 'fire') {
    colorClass = value < 1000 ? "bg-[var(--ifrit-fire)] animate-pulse" : "bg-[var(--ifrit-safe)]";
  } else if (type === 'gas') {
    colorClass = value > 800 ? "bg-[var(--ifrit-warning)]" : "bg-[var(--ifrit-safe)]";
  } else if (type === 'env') {
    if (label.includes('Temp') && value > 35) colorClass = "bg-[var(--ifrit-warning)]";
  }

  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-[var(--ifrit-text-secondary)]">{label}</span>
        <span className="font-mono text-[var(--ifrit-text-primary)]">{value?.toFixed(1)} {unit}</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--ifrit-bg-tertiary)] rounded-full overflow-hidden border border-[var(--ifrit-border)]">
        <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedRoom, isLoading, fetchRoomDetail, clearSelectedRoom } = useRoomsStore();
  const { latestReadings, connectWebSocket } = useDashboardStore();
  
  const [timeRange, setTimeRange] = useState('1H');
  const [initialReadings, setInitialReadings] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [cameras, setCameras] = useState([]);

  useEffect(() => {
    fetchRoomDetail(id);
    return () => clearSelectedRoom();
  }, [id, fetchRoomDetail, clearSelectedRoom]);

  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

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
          setInitialReadings(readings);
        }
      } catch (err) {
        console.error('Failed to fetch sensor data:', err);
      }
    };
    fetchSensorData();
    // Replaced 5s polling with real-time WebSocket data from useDashboardStore
  }, [id, selectedRoom?.devices?.length]);

  // Combine initial readings with real-time websocket updates
  const sensorReadings = { ...initialReadings };
  if (selectedRoom?.devices) {
    for (const device of selectedRoom.devices) {
      const liveData = latestReadings[device.id];
      if (liveData) {
        Object.keys(liveData).forEach(key => {
          if (key !== '_lastUpdate') {
            sensorReadings[key] = liveData[key];
          }
        });
      }
    }
  }

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
        <div className="w-8 h-8 border-2 border-[var(--ifrit-brand)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>LOADING ROOM DATA...</p>
      </div>
    );
  }

  if (!selectedRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ifrit-text-primary)' }}>Room Not Found</h2>
        <button onClick={() => navigate('/rooms')} className="text-[var(--ifrit-brand)] hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Rooms
        </button>
      </div>
    );
  }

  const room = selectedRoom;
  const camera = cameras.length > 0 ? cameras[0] : null;
  const alerts = room.active_alerts || [];
  
  const envSensors = Object.entries(sensorReadings).filter(([k]) => SENSOR_CONFIG[k]?.type === 'env');
  const gasSensors = Object.entries(sensorReadings).filter(([k]) => SENSOR_CONFIG[k]?.type === 'gas');
  const fireSensors = Object.entries(sensorReadings).filter(([k]) => SENSOR_CONFIG[k]?.type === 'fire');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6" style={{ borderColor: 'var(--ifrit-border)' }}>
        <div>
          <button 
            onClick={() => navigate('/rooms')}
            className="flex items-center gap-2 text-xs font-semibold mb-3 hover:text-[var(--ifrit-brand)] transition-colors"
            style={{ color: 'var(--ifrit-text-muted)' }}
          >
            <ArrowLeft className="w-3 h-3" /> Back to Facility
          </button>
          <div className="flex items-center gap-3">
            <StatusIndicator status={room.status === 'critical' ? 'fire' : room.status} size="lg" />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>{room.name}</h1>
            
            <span className="text-xs px-2 py-1 rounded font-mono mt-1" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-secondary)' }}>
              Location: {room.floor || room.building_name || '—'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-1" style={{ color: 'var(--ifrit-text-muted)' }}>
          <span className="text-xs">Devices: {room.devices?.length || 0} | Sensors: {room.sensor_count || 0}</span>
          <div className="flex items-center gap-1.5 font-mono text-sm">
            <Clock className="w-4 h-4" />
            {new Date(room.created_at).toLocaleString('en-US')}
          </div>
        </div>
      </div>

      <h2 className="text-sm font-bold mb-2 mt-4" style={{ color: 'var(--ifrit-text-muted)' }}>Safety Dashboard</h2>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Prominent Camera Feed */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {camera ? (
            <div className="flex flex-col rounded-xl overflow-hidden border-2" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: camera.has_detection ? 'var(--ifrit-fire)' : 'var(--ifrit-border)' }}>
               <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ifrit-border)' }}>
                 <div className="flex items-center gap-2">
                   <Video className="w-4 h-4" style={{ color: 'var(--ifrit-text-secondary)' }} />
                   <h2 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Live Video Feed</h2>
                 </div>
                 {camera.has_detection && (
                   <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                     <AlertTriangle className="w-3 h-3" /> DANGER DETECTED
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
             <div className="p-12 text-center border-2 border-dashed rounded-xl flex flex-col items-center justify-center h-full" style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-muted)', backgroundColor: 'var(--ifrit-bg-tertiary)' }}>
               <Video className="w-8 h-8 mb-2 opacity-50" />
               <p>No camera connected to this area.</p>
               <p className="text-[10px] font-mono mt-1 opacity-50">Contact security to add a camera</p>
             </div>
          )}
        </div>

        {/* Logical Sensor Groups */}
        <div className="xl:col-span-1 flex flex-col gap-4">
          
          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Thermometer className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Air & Temperature</h3>
            </div>
            {envSensors.length > 0 ? envSensors.map(([k, v]) => (
              <SensorBar key={k} label={SENSOR_CONFIG[k].label} value={v} unit={SENSOR_CONFIG[k].unit} type="env" />
            )) : <p className="text-xs text-[var(--ifrit-text-muted)] italic">No environment sensors online.</p>}
          </div>

          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Wind className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Smoke & Gas Levels</h3>
            </div>
            {gasSensors.length > 0 ? gasSensors.map(([k, v]) => (
              <SensorBar key={k} label={SENSOR_CONFIG[k].label} value={v} unit={SENSOR_CONFIG[k].unit} type="gas" />
            )) : <p className="text-xs text-[var(--ifrit-text-muted)] italic">No gas sensors online.</p>}
          </div>

          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-[var(--ifrit-fire)]" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Fire Detections</h3>
            </div>
            {fireSensors.length > 0 ? fireSensors.map(([k, v]) => (
              <SensorBar key={k} label={SENSOR_CONFIG[k].label} value={v} unit={SENSOR_CONFIG[k].unit} type="fire" />
            )) : <p className="text-xs text-[var(--ifrit-text-muted)] italic">No fire sensors online.</p>}
          </div>

        </div>
      </div>

      <h2 className="text-sm font-bold mb-2 mt-8 pt-4 border-t" style={{ color: 'var(--ifrit-text-muted)', borderColor: 'var(--ifrit-border)' }}>Historical Data</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Historical Charts */}
        <div className="lg:col-span-3 border rounded-xl p-5 flex flex-col" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
           <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
             <div className="flex items-center gap-2">
               <Activity className="w-4 h-4" style={{ color: 'var(--ifrit-text-secondary)' }} />
               <h2 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Safety Trends</h2>
             </div>
             
             <div className="flex items-center rounded-md p-1 border" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
               {['1H', '24H', '7D', '30D'].map(range => (
                 <button
                   key={range}
                   onClick={() => setTimeRange(range)}
                   className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                     timeRange === range 
                       ? 'shadow border'
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
           
           <div className="flex-1 mt-2">
             {trendData.length > 0 ? (
               <SensorChart data={trendData} sensors={Object.keys(trendData[0]).filter(k => k !== 'time')} height={300} />
             ) : (
               <div className="h-[300px] flex items-center justify-center" style={{ color: 'var(--ifrit-text-muted)' }}>
                 <p className="text-xs font-mono">NO HISTORICAL DATA IN WINDOW</p>
               </div>
             )}
           </div>
        </div>

        {/* Alert History */}
        <div className="lg:col-span-2 border rounded-xl flex flex-col overflow-hidden h-full" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)', minHeight: '300px' }}>
           <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" style={{ color: 'var(--ifrit-text-secondary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>Recent Safety Events</h3>
              </div>
              <span className="text-xs font-mono px-2 rounded-full" style={{ backgroundColor: 'var(--ifrit-bg-primary)', color: 'var(--ifrit-text-muted)' }}>{alerts.length}</span>
           </div>
           <div className="p-3 space-y-3 overflow-y-auto flex-1 h-[300px]">
              {alerts.length > 0 ? (
                alerts.map(a => (
                  <div key={a.id} className="p-3 rounded-md border" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIndicator status={a.severity === 'critical' ? 'fire' : 'warning'} size="sm" />
                      <span className="text-xs font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>{a.alert_type || 'Alert'}</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--ifrit-text-secondary)' }}>{a.message}</p>
                    <span className="text-[10px] font-mono mt-1 block" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {new Date(a.created_at).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center h-full flex flex-col items-center justify-center font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
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
