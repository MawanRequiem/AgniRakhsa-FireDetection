import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useDashboardStore } from '@/stores/useDashboardStore';

// Color palette for different sensor types
const SENSOR_COLORS = {
  MQ2: '#f59e0b',    // amber  — Smoke / LPG
  MQ4: '#3b82f6',    // blue   — Methane
  MQ5: '#8b5cf6',    // violet — Natural Gas / LPG
  MQ7: '#ef4444',    // red    — Carbon Monoxide
  MQ9B: '#06b6d4',   // cyan   — CO + Methane
  MQ135: '#ec4899',  // pink   — Air Quality
  SHTC3_TEMP: '#f97316',     // orange
  SHTC3_HUMIDITY: '#10b981', // emerald
};

const SENSOR_FALLBACK_COLOR = '#6b7280';

export default function SensorsOverview() {
  const sensorHistory = useDashboardStore((state) => state.sensorHistory);

  // Extract available sensor keys from data
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

  // Format timestamps for X axis
  const formattedData = useMemo(() => {
    return sensorHistory.map((point) => {
      let label = '';
      try {
        const d = new Date(point.time);
        label = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      } catch {
        label = point.time || '';
      }
      return { ...point, time: label };
    });
  }, [sensorHistory]);

  if (!sensorHistory || sensorHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--agni-text-muted)' }}>
          AWAITING TELEMETRY DATA...
        </p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--agni-border)" opacity={0.3} />
        <XAxis 
          dataKey="time" 
          tick={{ fill: 'var(--agni-text-muted)', fontSize: 9, fontFamily: 'monospace' }}
          stroke="var(--agni-border)"
          interval="preserveStartEnd"
        />
        <YAxis 
          tick={{ fill: 'var(--agni-text-muted)', fontSize: 9, fontFamily: 'monospace' }} 
          stroke="var(--agni-border)"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--agni-bg-secondary)',
            border: '1px solid var(--agni-border)',
            borderRadius: '2px',
            color: 'var(--agni-text-primary)',
            fontSize: '10px',
            fontFamily: 'monospace',
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '9px', fontFamily: 'monospace' }}
        />
        {sensorKeys.map((key) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={SENSOR_COLORS[key] || SENSOR_FALLBACK_COLOR}
            fill={SENSOR_COLORS[key] || SENSOR_FALLBACK_COLOR}
            fillOpacity={0.08}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
