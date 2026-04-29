import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';

const SENSOR_COLORS = {
  MQ2: 'var(--ifrit-warning)',
  MQ4: 'var(--ifrit-info)',
  MQ5: '#8b5cf6',
  MQ6: '#fbbf24',
  MQ7: 'var(--ifrit-fire)',
  MQ9B: '#06b6d4',
  MQ135: '#ec4899',
  SHTC3_TEMP: '#f97316',
  SHTC3_HUMIDITY: 'var(--ifrit-safe)',
};

const SENSOR_FALLBACK_COLOR = '#6b7280';

export default function SensorsOverview() {
  const sensorHistory = useDashboardStore((state) => state.sensorHistory);

  const sensorKeys = useMemo(() => {
    if (!sensorHistory || sensorHistory.length === 0) return [];
    const keys = new Set();
    for (const point of sensorHistory) {
      for (const key of Object.keys(point)) {
        if (key !== 'time') keys.add(key);
      }
    }
    return Array.from(keys);
  }, [sensorHistory]);

  const formattedData = useMemo(() => {
    return sensorHistory.map((point) => {
      let label = '';
      try {
        const d = new Date(point.time);
        label = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        label = point.time || '';
      }
      return { ...point, time: label };
    });
  }, [sensorHistory]);

  if (!sensorHistory || sensorHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] gap-3">
        <Activity className="w-8 h-8 opacity-20" style={{ color: 'var(--ifrit-text-muted)' }} />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--ifrit-text-secondary)' }}>
            No active telemetry
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>
            Waiting for sensor data from connected nodes
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ifrit-border)" opacity={0.3} />
        <XAxis 
          dataKey="time" 
          tick={{ fill: 'var(--ifrit-text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
          stroke="var(--ifrit-border)"
          interval="preserveStartEnd"
        />
        <YAxis 
          tick={{ fill: 'var(--ifrit-text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} 
          stroke="var(--ifrit-border)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--ifrit-bg-secondary)',
            border: '1px solid var(--ifrit-border)',
            borderRadius: '6px',
            color: 'var(--ifrit-text-primary)',
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        <Legend 
          verticalAlign="top"
          align="right"
          wrapperStyle={{ fontSize: '10px', fontFamily: "'JetBrains Mono', monospace", paddingBottom: '10px' }}
        />
        {sensorKeys.map((key) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={SENSOR_COLORS[key] || SENSOR_FALLBACK_COLOR}
            fill={SENSOR_COLORS[key] || SENSOR_FALLBACK_COLOR}
            fillOpacity={0.06}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
