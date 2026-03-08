import StatCard from '@/components/dashboard/StatCard';
import RoomCard from '@/components/dashboard/RoomCard';
import SensorChart from '@/components/dashboard/SensorChart';
import AlertItem from '@/components/dashboard/AlertItem';
import HoverClue from '@/components/ui/HoverClue';
import { ROOMS, ALERTS, SYSTEM_STATS, SENSOR_TRENDS } from '@/data/mockData';
import { Building2, Activity, BellRing, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  // Get a sample room's dataset for the overview chart
  const sampleTrend = SENSOR_TRENDS['R006']; // Using R006 as it has engaging data
  const recentAlerts = ALERTS.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-4">
        <div>
           <div className="flex items-center">
             <h2 className="text-2xl font-bold" style={{ color: 'var(--agni-text-primary)' }}>Overview</h2>
             <HoverClue text="Halaman ini memberikan ringkasan kondisi seluruh gedung secara real-time. Peringatan berwarna merah (Fire) butuh tindakan segera." />
           </div>
           <p className="text-sm mt-1" style={{ color: 'var(--agni-text-secondary)' }}>Status fasilitas saat ini.</p>
        </div>
      </div>
      
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-4">
        <StatCard 
          label="Total Rooms" 
          value={SYSTEM_STATS.totalRooms} 
          icon={Building2} 
        />
        <StatCard 
          label="Active Sensors" 
          value={SYSTEM_STATS.activeSensors} 
          icon={Activity} 
          trend={0} 
        />
        <StatCard 
          label="Active Alerts" 
          value={SYSTEM_STATS.activeAlerts} 
          icon={BellRing} 
          trend={12.5} 
          className={SYSTEM_STATS.activeAlerts > 0 ? "border-[var(--agni-fire)] bg-[rgba(248,113,113,0.05)]" : ""}
        />
      </div>

      {/* Middle Section: Chart & Recent Alerts (Asymmetric 60/40) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 h-full flex flex-col">
          <div className="flex items-center mb-2 px-1">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--agni-text-primary)' }}>Sensor Trends (R006)</h3>
            <HoverClue text="Grafik ini menampilkan rata-rata pergerakan sensor dari ruangan yang paling butuh perhatian saat ini (misalnya R006). Data level Asap, Karbon Monoksida, dan Temperatur dicatat secara historis." />
          </div>
          <div className="flex-1">
            <SensorChart data={sampleTrend} sensors={['co', 'flame', 'smoke']} height={320} />
          </div>
        </div>
        
        <div className="lg:col-span-2 flex flex-col h-full rounded-md border" style={{ backgroundColor: 'var(--agni-bg-tertiary)', borderColor: 'var(--agni-border)' }}>
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--agni-border)' }}>
            <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>
              Recent Alerts
            </h3>
            <button 
              onClick={() => navigate('/alerts')}
              className="text-[10px] uppercase font-bold flex items-center gap-1 hover:text-[var(--agni-text-primary)] transition-colors"
              style={{ color: 'var(--agni-text-secondary)' }}
            >
              View All <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          
          <div className="p-3 space-y-2 overflow-y-auto flex-1" style={{ maxHeight: '265px' }}>
            {recentAlerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} compact />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Room Grid */}
      <div>
        <div className="flex items-center justify-between mb-4 mt-6">
          <div className="flex items-center">
            <h2 className="text-xl font-bold" style={{ color: 'var(--agni-text-primary)' }}>
              Facility Status
            </h2>
            <HoverClue text="Status detail pada tiap ruangan. Warna merah mengindikasikan deteksi api atau anomali tingkat tinggi." />
          </div>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--agni-text-muted)' }}>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--agni-safe)]" /> Safe</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--agni-warning)]" /> Warning</span>
            <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[var(--agni-fire)]" /> Fire</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {ROOMS.map(room => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </div>
    </div>
  );
}
