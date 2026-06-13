import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Video, Activity, AlertTriangle, History, Thermometer, Droplets, Flame, Wind, Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';
import SensorChart from '@/components/dashboard/SensorChart';
import CameraFeed from '@/components/cctv/CameraFeed';
import { useRoomsStore } from '@/stores/useRoomsStore';
import { customFetch } from '@/lib/api';
import { useDashboardStore } from '@/stores/useDashboardStore';
import RoomDeviceCalibration from '@/components/devices/RoomDeviceCalibration';
import RoomDeviceExportCard from '@/components/devices/RoomDeviceExportCard';
import { useUIStore } from '@/store/store';

const SENSOR_CONFIG = {
  // Temperature keys
  SHTC_TEMP: { label: 'Suhu Ruangan', unit: '°C', type: 'env', max: 50 },
  SHTC3_TEMP: { label: 'Suhu Ruangan', unit: '°C', type: 'env', max: 50 },
  
  // Humidity keys
  SHTC_HUM: { label: 'Kelembapan Udara', unit: '%', type: 'env', max: 100 },
  SHTC3_HUMIDITY: { label: 'Kelembapan Udara', unit: '%', type: 'env', max: 100 },
  SHTC3_HUM: { label: 'Kelembapan Udara', unit: '%', type: 'env', max: 100 },
  
  // Flame keys
  FLAME: { label: 'Deteksi Api (Sensor)', unit: 'raw', type: 'fire', max: 4095 },
  flame: { label: 'Deteksi Api (Sensor)', unit: 'raw', type: 'fire', max: 4095 },

  // Gas keys
  MQ2: { label: 'MQ-2 (Detektor Asap)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ4: { label: 'MQ-4 (Gas Metana)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ5: { label: 'MQ-5 (Gas Alam)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ6: { label: 'MQ-6 (Gas LPG)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ7: { label: 'MQ-7 (Karbon Monoksida)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ9B: { label: 'MQ-9B (Gas Karbon)', unit: 'ppm', type: 'gas', max: 4095 },
  MQ135: { label: 'MQ-135 (Kualitas Udara)', unit: 'ppm', type: 'gas', max: 4095 },
  
  // Legacy / Lowercase keys
  co: { label: 'MQ-7 (Karbon Monoksida)', unit: 'ppm', type: 'gas', max: 4095 },
  lpg: { label: 'MQ-6 (Gas LPG)', unit: 'ppm', type: 'gas', max: 4095 },
  smoke: { label: 'MQ-2 (Detektor Asap)', unit: 'ppm', type: 'gas', max: 4095 },
  cng: { label: 'MQ-5 (Gas Alam)', unit: 'ppm', type: 'gas', max: 4095 },
};

const SENSOR_LABELS = {
  'Suhu Ruangan': { en: 'Room Temperature', id: 'Room Temperature' },
  'Kelembapan Udara': { en: 'Air Humidity', id: 'Air Humidity' },
  'Deteksi Api (Sensor)': { en: 'Flame Detector', id: 'Flame Detector' },
  'MQ-2 (Detektor Asap)': { en: 'MQ-2 (Smoke & LPG)', id: 'MQ-2 (Smoke & LPG)' },
  'MQ-4 (Gas Metana)': { en: 'MQ-4 (Methane CH4)', id: 'MQ-4 (Methane CH4)' },
  'MQ-5 (Gas Alam)': { en: 'MQ-5 (Natural Gas)', id: 'MQ-5 (Gas Alam)' },
  'MQ-6 (Gas LPG)': { en: 'MQ-6 (LPG Gas)', id: 'MQ-6 (LPG Gas)' },
  'MQ-7 (Karbon Monoksida)': { en: 'MQ-7 (Carbon Monoxide CO)', id: 'MQ-7 (Carbon Monoxide CO)' },
  'MQ-9B (Gas Karbon)': { en: 'MQ-9B (Carbon Monoxide CO)', id: 'MQ-9B (Carbon Monoxide CO)' },
  'MQ-135 (Kualitas Udara)': { en: 'MQ-135 (Air Quality)', id: 'MQ-135 (Air Quality)' },
};

function SensorBar({ label, value, unit, type }) {
  const language = useUIStore((s) => s.language);
  const isEn = language === 'en';
  const displayLabel = SENSOR_LABELS[label] ? SENSOR_LABELS[label][isEn ? 'en' : 'id'] : label;

  const config = Object.values(SENSOR_CONFIG).find(c => c.label === label);
  const max = config ? config.max : 4095;
  
  // Calculate percentage
  let pct = Math.min(100, Math.max(0, (value / max) * 100));
  if (label.toLowerCase().includes('flame')) {
    // Invert for active-low flame sensor: 0 raw = 100% danger/intensity, 4095 raw = 0% danger/intensity
    pct = Math.min(100, Math.max(0, 100 - (value / max) * 100));
  }

  // Determine color and status
  let color = 'var(--ifrit-info)'; // Default info blue
  let isPulsing = false;

  if (type === 'fire') {
    if (value < 1000) {
      color = 'var(--ifrit-fire)';
      isPulsing = true;
    } else {
      color = 'var(--ifrit-safe)';
    }
  } else if (type === 'gas') {
    if (value > 1500) {
      color = 'var(--ifrit-fire)';
    } else if (value > 800) {
      color = 'var(--ifrit-warning)';
    } else {
      color = 'var(--ifrit-safe)';
    }
  } else if (type === 'env') {
    if (label.toLowerCase().includes('temp')) {
      if (value > 45) {
        color = 'var(--ifrit-fire)';
      } else if (value > 35) {
        color = 'var(--ifrit-warning)';
      } else {
        color = 'var(--ifrit-info)';
      }
    } else if (label.toLowerCase().includes('humid')) {
      if (value > 80 || value < 30) {
        color = 'var(--ifrit-warning)';
      } else {
        color = 'var(--ifrit-info)';
      }
    }
  }

  return (
    <div className="flex flex-col gap-1 mb-3">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-[var(--ifrit-text-secondary)]">{displayLabel}</span>
        <span className="font-mono text-[var(--ifrit-text-primary)]">{value?.toFixed(1)} {unit}</span>
      </div>
      <div className="h-1.5 w-full bg-[var(--ifrit-bg-tertiary)] rounded-full overflow-hidden border border-[var(--ifrit-border)]">
        <div 
          className={`h-full transition-all duration-500 ${isPulsing ? 'animate-pulse' : ''}`} 
          style={{ width: `${pct}%`, backgroundColor: color }} 
        />
      </div>
    </div>
  );
}

export default function RoomDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedRoom, isLoading, fetchRoomDetail, clearSelectedRoom } = useRoomsStore();
  const { latestReadings, connectWebSocket } = useDashboardStore();
  const language = useUIStore((s) => s.language);
  const isEn = language === 'en';
  
  const [timeRange, setTimeRange] = useState('1H');
  const [initialReadings, setInitialReadings] = useState({});
  const [trendData, setTrendData] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [detectionImages, setDetectionImages] = useState([]);
  const [detectionPage, setDetectionPage] = useState(1);
  const [detectionTotal, setDetectionTotal] = useState(0);
  const [lightboxIdx, setLightboxIdx] = useState(null);

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
    const minutesMap = { '1H': 60, '24H': 1440, '7D': 10080, '30D': 43200 };
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

  // Fetch detection image gallery
  useEffect(() => {
    const fetchDetections = async () => {
      try {
        const response = await customFetch(`/api/v1/rooms/${id}/detections?page=${detectionPage}&page_size=12`);
        if (response.ok) {
          const data = await response.json();
          setDetectionImages(data.items || []);
          setDetectionTotal(data.total || 0);
        }
      } catch (err) {
        console.error('Failed to fetch detection images:', err);
      }
    };
    fetchDetections();
  }, [id, detectionPage]);

  if (isLoading && !selectedRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-[var(--ifrit-brand)] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
          {isEn ? 'LOADING ROOM DATA...' : 'MEMUAT DATA RUANGAN...'}
        </p>
      </div>
    );
  }

  if (!selectedRoom) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--ifrit-text-primary)' }}>
          {isEn ? 'Room Not Found' : 'Ruangan Tidak Ditemukan'}
        </h2>
        <button onClick={() => navigate('/rooms')} className="text-[var(--ifrit-brand)] hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> {isEn ? 'Back to Rooms List' : 'Kembali ke Daftar Ruangan'}
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
            <ArrowLeft className="w-3 h-3" /> {isEn ? 'Back to Facility' : 'Kembali ke Fasilitas'}
          </button>
          <div className="flex items-center gap-3">
            <StatusIndicator status={room.status === 'critical' ? 'fire' : room.status} size="lg" />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>{room.name}</h1>
            
            <span className="text-xs px-2 py-1 rounded font-mono mt-1" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', color: 'var(--ifrit-text-secondary)' }}>
              {isEn ? 'Location' : 'Lokasi'}: {room.floor || room.building_name || '-'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-start md:items-end gap-1" style={{ color: 'var(--ifrit-text-muted)' }}>
          <span className="text-xs">
            {isEn ? 'Devices' : 'Perangkat'}: {room.devices?.length || 0} | {isEn ? 'Sensors' : 'Sensor'}: {room.sensor_count || 0}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-sm">
            <Clock className="w-4 h-4" />
            {new Date(room.created_at).toLocaleString(isEn ? 'en-US' : 'id-ID')}
          </div>
        </div>
      </div>

      <h2 className="text-sm font-bold mb-2 mt-4" style={{ color: 'var(--ifrit-text-muted)' }}>
        {isEn ? 'Safety Dashboard' : 'Dasbor Keamanan'}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Widescreen Camera Feed & Administration Tools */}
        <div className="lg:col-span-2 space-y-6">
          {camera ? (
            <div 
              className="relative w-full rounded-xl overflow-hidden border shadow-sm transition-all duration-300" 
              style={{ 
                aspectRatio: '16/9',
                borderColor: camera.has_detection ? 'var(--ifrit-fire)' : 'var(--ifrit-border)',
                boxShadow: camera.has_detection ? '0 0 20px rgba(239, 68, 68, 0.2)' : 'none'
              }}
            >
              <CameraFeed camera={camera} hideBorder={true} />
            </div>
          ) : (
            <div 
              className="p-8 text-center border border-dashed rounded-xl flex flex-col items-center justify-center min-h-[260px] lg:h-[320px]" 
              style={{ 
                borderColor: 'var(--ifrit-border)', 
                color: 'var(--ifrit-text-muted)', 
                backgroundColor: 'var(--ifrit-bg-tertiary)' 
              }}
            >
              <Video className="w-8 h-8 mb-3 opacity-40 text-[var(--ifrit-brand)]" />
              <p className="text-sm font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {isEn ? 'No Live Video Stream' : 'Tidak Ada Siaran Video Langsung'}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-secondary)' }}>
                {isEn ? 'CCTV stream has not been configured for this safety area.' : 'Siaran CCTV belum dikonfigurasi untuk area keamanan ini.'}
              </p>
              <p className="text-[10px] font-mono mt-3 opacity-55">
                {isEn ? 'Contact the system administrator to link a camera.' : 'Hubungi administrator sistem untuk menautkan kamera'}
              </p>
            </div>
          )}

          {/* Admin panels side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RoomDeviceCalibration devices={room.devices} />
            <RoomDeviceExportCard roomId={room.id} devices={room.devices} />
          </div>
        </div>

        {/* Right Column: Sensor Groups */}
        <div className="lg:col-span-1 space-y-6">
          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Thermometer className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {isEn ? 'Air Conditions & Temperature' : 'Kondisi Udara & Suhu'}
              </h3>
            </div>
            {envSensors.length > 0 ? envSensors.map(([k, v]) => (
              <SensorBar key={k} label={SENSOR_CONFIG[k].label} value={v} unit={SENSOR_CONFIG[k].unit} type="env" />
            )) : <p className="text-xs text-[var(--ifrit-text-muted)] italic">{isEn ? 'No active environmental sensors.' : 'Tidak ada sensor udara aktif.'}</p>}
          </div>

          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Wind className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {isEn ? 'Smoke & Gas Levels' : 'Kadar Asap & Gas'}
              </h3>
            </div>
            {gasSensors.length > 0 ? gasSensors.map(([k, v]) => (
              <SensorBar key={k} label={SENSOR_CONFIG[k].label} value={v} unit={SENSOR_CONFIG[k].unit} type="gas" />
            )) : <p className="text-xs text-[var(--ifrit-text-muted)] italic">{isEn ? 'No active smoke/gas detectors.' : 'Tidak ada sensor asap/gas aktif.'}</p>}
          </div>

          <div className="border rounded-xl p-4" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Flame className="w-4 h-4 text-[var(--ifrit-fire)]" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                {isEn ? 'Flame Detectors' : 'Detektor Api'}
              </h3>
            </div>
            {fireSensors.length > 0 ? fireSensors.map(([k, v]) => (
              <SensorBar key={k} label={SENSOR_CONFIG[k].label} value={v} unit={SENSOR_CONFIG[k].unit} type="fire" />
            )) : <p className="text-xs text-[var(--ifrit-text-muted)] italic">{isEn ? 'No active flame detectors.' : 'Tidak ada sensor deteksi api aktif.'}</p>}
          </div>
        </div>

      </div>

      <h2 className="text-sm font-bold mb-2 mt-8 pt-4 border-t" style={{ color: 'var(--ifrit-text-muted)', borderColor: 'var(--ifrit-border)' }}>
        {isEn ? 'Historical Data' : 'Data Riwayat'}
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Historical Charts */}
        <div className="lg:col-span-3 border rounded-xl p-5 flex flex-col" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
           <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
             <div className="flex items-center gap-2">
               <Activity className="w-4 h-4" style={{ color: 'var(--ifrit-text-secondary)' }} />
               <h2 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                 {isEn ? 'Safety Trends' : 'Tren Keamanan'}
               </h2>
             </div>
             
             <div className="flex items-center rounded-md p-1 border" style={{ backgroundColor: 'var(--ifrit-bg-secondary)', borderColor: 'var(--ifrit-border)' }}>
               {['1H', '24H', '7D', '30D'].map(range => (
                 <button
                   key={range}
                   onClick={() => setTimeRange(range)}
                   className={`px-3 py-1 text-xs font-bold rounded transition-colors cursor-pointer ${
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
               <SensorChart data={trendData} timeRange={timeRange} height={300} />
             ) : (
               <div className="h-[300px] flex items-center justify-center" style={{ color: 'var(--ifrit-text-muted)' }}>
                 <p className="text-xs font-mono">
                   {isEn ? 'NO HISTORICAL DATA FOR THIS PERIOD' : 'TIDAK ADA DATA RIWAYAT PADA PERIODE INI'}
                 </p>
               </div>
             )}
           </div>
        </div>

        {/* Alert History */}
        <div className="lg:col-span-2 border rounded-xl flex flex-col overflow-hidden h-full" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)', minHeight: '300px' }}>
           <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
              <div className="flex items-center gap-2">
                <History className="w-4 h-4" style={{ color: 'var(--ifrit-text-secondary)' }} />
                <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
                  {isEn ? 'Recent Safety Events' : 'Kejadian Keamanan Terkini'}
                </h3>
              </div>
              <span className="text-xs font-mono px-2 rounded-full" style={{ backgroundColor: 'var(--ifrit-bg-primary)', color: 'var(--ifrit-text-muted)' }}>{alerts.length}</span>
           </div>
           <div className="p-3 space-y-3 overflow-y-auto flex-1 h-[300px]">
              {alerts.length > 0 ? (
                alerts.map(a => (
                  <div key={a.id} className="p-3 rounded-md border" style={{ backgroundColor: 'var(--ifrit-bg-primary)', borderColor: 'var(--ifrit-border)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIndicator status={a.severity === 'critical' ? 'fire' : 'warning'} size="sm" />
                      <span className="text-xs font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
                        {a.alert_type || (isEn ? 'Alert' : 'Peringatan')}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--ifrit-text-secondary)' }}>{a.message}</p>
                    <span className="text-[10px] font-mono mt-1 block" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {new Date(a.created_at).toLocaleString(isEn ? 'en-US' : 'id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center h-full flex flex-col items-center justify-center font-medium" style={{ color: 'var(--ifrit-text-muted)' }}>
                  <History className="w-8 h-8 mb-2 opacity-30" />
                  {isEn ? 'No active alerts for this room.' : 'Tidak ada peringatan aktif untuk ruangan ini.'}
                </div>
              )}
           </div>
      </div>
      </div>

      {/* Detection Image Gallery */}
      <h2 className="text-sm font-bold mb-2 mt-8 pt-4 border-t" style={{ color: 'var(--ifrit-text-muted)', borderColor: 'var(--ifrit-border)' }}>
        {isEn ? 'Fire Detection Captures' : 'Tangkapan Deteksi Api'}
      </h2>
      <div className="border rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--ifrit-bg-tertiary)', borderColor: 'var(--ifrit-border)' }}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-secondary)' }}>
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" style={{ color: 'var(--ifrit-text-secondary)' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--ifrit-text-primary)' }}>
              {isEn ? 'AI Detection Log' : 'Log Deteksi AI'}
            </h3>
          </div>
          <span className="text-xs font-mono px-2 rounded-full" style={{ backgroundColor: 'var(--ifrit-bg-primary)', color: 'var(--ifrit-text-muted)' }}>
            {detectionTotal} {isEn ? 'captures' : 'tangkapan'}
          </span>
        </div>

        {detectionImages.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
              {detectionImages.map((det, idx) => (
                <div
                  key={det.id}
                  className="relative group cursor-pointer rounded-lg overflow-hidden border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                  style={{ borderColor: 'var(--ifrit-border)', backgroundColor: 'var(--ifrit-bg-primary)' }}
                  onClick={() => setLightboxIdx(idx)}
                >
                  <div className="aspect-video relative">
                    <img
                      src={det.image_url}
                      alt={`Detection ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Confidence badge */}
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: det.max_confidence >= 0.7 ? 'var(--ifrit-fire)' : det.max_confidence >= 0.5 ? 'var(--ifrit-warning)' : 'var(--ifrit-info)' }}>
                      {(det.max_confidence * 100).toFixed(0)}%
                    </div>
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">{isEn ? 'View Full' : 'Lihat Detail'}</span>
                    </div>
                  </div>
                  <div className="px-2 py-1.5">
                    <span className="text-[10px] font-mono block" style={{ color: 'var(--ifrit-text-muted)' }}>
                      {new Date(det.created_at).toLocaleString(isEn ? 'en-US' : 'id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {detectionTotal > 12 && (
              <div className="flex items-center justify-center gap-3 px-4 py-3 border-t" style={{ borderColor: 'var(--ifrit-border)' }}>
                <button
                  onClick={() => setDetectionPage(p => Math.max(1, p - 1))}
                  disabled={detectionPage <= 1}
                  className="px-3 py-1 text-xs font-semibold rounded border transition-colors disabled:opacity-30"
                  style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}
                >
                  {isEn ? 'Previous' : 'Sebelumnya'}
                </button>
                <span className="text-xs font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>
                  {detectionPage} / {Math.ceil(detectionTotal / 12)}
                </span>
                <button
                  onClick={() => setDetectionPage(p => p + 1)}
                  disabled={detectionPage >= Math.ceil(detectionTotal / 12)}
                  className="px-3 py-1 text-xs font-semibold rounded border transition-colors disabled:opacity-30"
                  style={{ borderColor: 'var(--ifrit-border)', color: 'var(--ifrit-text-secondary)' }}
                >
                  {isEn ? 'Next' : 'Selanjutnya'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center flex flex-col items-center justify-center" style={{ color: 'var(--ifrit-text-muted)' }}>
            <Camera className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-medium" style={{ color: 'var(--ifrit-text-secondary)' }}>
              {isEn ? 'No fire detection captures yet' : 'Belum ada tangkapan deteksi api'}
            </p>
            <p className="text-xs mt-1">
              {isEn ? 'Images will appear here when the AI detects fire in the camera feed.' : 'Gambar akan muncul di sini saat AI mendeteksi api dari kamera.'}
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxIdx !== null && detectionImages[lightboxIdx] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxIdx(null)}
        >
          <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxIdx(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Navigation arrows */}
            {lightboxIdx > 0 && (
              <button
                onClick={() => setLightboxIdx(i => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-all z-10"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {lightboxIdx < detectionImages.length - 1 && (
              <button
                onClick={() => setLightboxIdx(i => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-all z-10"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <img
              src={detectionImages[lightboxIdx].image_url}
              alt="Detection detail"
              className="w-full rounded-xl shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between text-white/80">
              <span className="text-sm font-semibold">
                {isEn ? 'Confidence' : 'Kepercayaan'}: {(detectionImages[lightboxIdx].max_confidence * 100).toFixed(1)}%
              </span>
              <span className="text-xs font-mono">
                {new Date(detectionImages[lightboxIdx].created_at).toLocaleString(isEn ? 'en-US' : 'id-ID')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
