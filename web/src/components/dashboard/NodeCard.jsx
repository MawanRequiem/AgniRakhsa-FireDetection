import { Activity, Flame, Thermometer, Wind, AlertTriangle, Droplets } from 'lucide-react';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '@/stores/useDashboardStore';

export default function NodeCard({ device, roomName, latestReadings }) {
  const navigate = useNavigate();
  const sensorHealth = useDashboardStore((state) => state.sensorHealth);
  const isOnline = device.status === 'online';
  
  // Format specific sensor readings
  const temp = latestReadings?.SHTC3_TEMP?.toFixed(1) || '--';
  const hum = latestReadings?.SHTC3_HUMIDITY?.toFixed(1) || '--';
  
  // Gas sensors (ppm)
  const mqSensors = ['MQ2', 'MQ4', 'MQ5', 'MQ6', 'MQ7', 'MQ9B', 'MQ135'];
  const gasLevels = mqSensors.map(type => ({
    type,
    value: latestReadings?.[type] !== undefined ? Math.round(latestReadings[type]) : null
  })).filter(g => g.value !== null);
  
  // Flame IR
  const flameRaw = latestReadings?.FLAME;
  const isFire = flameRaw !== undefined && flameRaw < 1000; // Assuming threshold
  
  // Determine card status border
  let statusColor = 'var(--ifrit-border)';
  if (!isOnline) {
    statusColor = 'var(--ifrit-text-muted)';
  } else if (isFire) {
    statusColor = 'var(--ifrit-fire)';
  } else if (gasLevels.some(g => g.value > 800)) {
    statusColor = 'var(--ifrit-warning)';
  }
  
  return (
    <div 
      onClick={() => device.room_id && navigate(`/rooms/${device.room_id}`)}
      className="flex flex-col border rounded-lg p-4 cursor-pointer transition-all hover:bg-[var(--ifrit-bg-secondary)]"
      style={{ 
        backgroundColor: 'var(--ifrit-bg-primary)', 
        borderColor: statusColor,
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <StatusIndicator status={isOnline ? (isFire ? 'critical' : 'online') : 'offline'} size="sm" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--ifrit-text-primary)]">
              {roomName || 'Unassigned Node'}
            </h3>
            <p className="text-[10px] text-[var(--ifrit-text-muted)] font-mono">{device.id.split('-')[0]}</p>
          </div>
        </div>
      </div>
      
      {/* SHTC3 Environment */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {(() => {
          const tempHealth = sensorHealth?.sensors?.find(s => s.device_id === device.id && s.sensor_type === 'SHTC3_TEMP');
          const isTempUnhealthy = tempHealth && tempHealth.status !== 'healthy';
          return (
            <div className={`flex items-center gap-2 p-2 rounded-md ${isTempUnhealthy ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--ifrit-bg-tertiary)]'}`} title={isTempUnhealthy ? `${tempHealth.status}: ${tempHealth.details?.reason}` : ''}>
              <Thermometer className={`w-3 h-3 ${isTempUnhealthy ? 'text-red-500' : 'text-[var(--ifrit-brand)]'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--ifrit-text-muted)]">
                  TEMP {isTempUnhealthy && <AlertTriangle className="inline w-2.5 h-2.5 text-red-500" />}
                </span>
                <span className={`text-xs font-mono ${isTempUnhealthy ? 'text-red-500 line-through opacity-70' : 'text-[var(--ifrit-text-primary)]'}`}>{temp}°C</span>
              </div>
            </div>
          );
        })()}
        
        {(() => {
          const humHealth = sensorHealth?.sensors?.find(s => s.device_id === device.id && s.sensor_type === 'SHTC3_HUMIDITY');
          const isHumUnhealthy = humHealth && humHealth.status !== 'healthy';
          return (
            <div className={`flex items-center gap-2 p-2 rounded-md ${isHumUnhealthy ? 'bg-red-500/10 border border-red-500/30' : 'bg-[var(--ifrit-bg-tertiary)]'}`} title={isHumUnhealthy ? `${humHealth.status}: ${humHealth.details?.reason}` : ''}>
              <Droplets className={`w-3 h-3 ${isHumUnhealthy ? 'text-red-500' : 'text-blue-400'}`} />
              <div className="flex flex-col">
                <span className="text-[10px] text-[var(--ifrit-text-muted)]">
                  HUM {isHumUnhealthy && <AlertTriangle className="inline w-2.5 h-2.5 text-red-500" />}
                </span>
                <span className={`text-xs font-mono ${isHumUnhealthy ? 'text-red-500 line-through opacity-70' : 'text-[var(--ifrit-text-primary)]'}`}>{hum}%</span>
              </div>
            </div>
          );
        })()}
      </div>
      
      {/* Flame Sensor */}
      {flameRaw !== undefined && (() => {
        const flameHealth = sensorHealth?.sensors?.find(s => s.device_id === device.id && s.sensor_type === 'FLAME');
        const isFlameUnhealthy = flameHealth && flameHealth.status !== 'healthy';
        
        return (
          <div className={`flex items-center justify-between p-2 rounded-md mb-3 ${isFlameUnhealthy ? 'bg-red-500/10 border border-red-500/30' : isFire ? 'bg-[var(--ifrit-fire)]/10 border border-[var(--ifrit-fire)]/30' : 'bg-[var(--ifrit-bg-tertiary)]'}`} title={isFlameUnhealthy ? `${flameHealth.status}: ${flameHealth.details?.reason}` : ''}>
            <div className="flex items-center gap-2">
              <Flame className={`w-3.5 h-3.5 ${isFlameUnhealthy ? 'text-red-500' : isFire ? 'text-[var(--ifrit-fire)] animate-pulse' : 'text-[var(--ifrit-text-muted)]'}`} />
              <span className="text-xs font-medium text-[var(--ifrit-text-primary)]">
                IR FLAME {isFlameUnhealthy && <AlertTriangle className="inline w-2.5 h-2.5 text-red-500 ml-1" />}
              </span>
            </div>
            <span className={`text-xs font-mono ${isFlameUnhealthy ? 'text-red-500 line-through opacity-70' : isFire ? 'text-[var(--ifrit-fire)] font-bold' : 'text-[var(--ifrit-text-secondary)]'}`}>
              {isFire ? 'DETECTED' : 'CLEAR'} ({Math.round(flameRaw)})
            </span>
          </div>
        );
      })()}

      {/* Gas Sensors (MQ Series) */}
      <div className="flex-1 flex flex-col gap-1.5">
        <h4 className="text-[10px] uppercase font-semibold text-[var(--ifrit-text-muted)] mb-1">Gas Array (PPM)</h4>
        {gasLevels.length > 0 ? (
          <div className="grid grid-cols-2 gap-1.5">
            {gasLevels.map((gas) => {
              const isHigh = gas.value > 800; // Sample threshold
              const health = sensorHealth?.sensors?.find(s => s.device_id === device.id && s.sensor_type === gas.type);
              const isUnhealthy = health && health.status !== 'healthy';
              
              return (
                <div key={gas.type} className={`flex justify-between items-center p-1.5 rounded-sm ${isUnhealthy ? 'bg-red-500/10 border-red-500/30' : 'bg-[var(--ifrit-bg-secondary)] border-[var(--ifrit-border)]'} border`} title={isUnhealthy ? `${health.status.toUpperCase()}: ${health.details?.reason || 'Unknown error'}` : ''}>
                  <span className="text-[10px] font-medium text-[var(--ifrit-text-secondary)]">
                    {gas.type}
                    {isUnhealthy && <AlertTriangle className="inline w-2.5 h-2.5 ml-1 text-red-500 mb-0.5" />}
                  </span>
                  <span className={`text-[10px] font-mono ${isUnhealthy ? 'text-red-500 line-through opacity-70' : isHigh ? 'text-[var(--ifrit-warning)] font-bold' : 'text-[var(--ifrit-text-primary)]'}`}>
                    {gas.value}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
           <p className="text-[10px] text-[var(--ifrit-text-muted)] italic">Awaiting telemetry...</p>
        )}
      </div>
    </div>
  );
}
