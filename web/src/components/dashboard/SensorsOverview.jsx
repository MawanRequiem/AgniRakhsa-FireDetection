import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Activity } from 'lucide-react';
import { useDashboardStore } from '@/stores/useDashboardStore';

const SENSOR_COLORS = {
  MQ2: '#f59e0b', // Amber - LPG/Smoke
  MQ4: '#10b981', // Emerald - Methane
  MQ5: '#06b6d4', // Cyan - Natural Gas
  MQ6: '#8b5cf6', // Purple - LPG
  MQ7: '#ef4444', // Red - CO
  MQ9B: '#3b82f6', // Blue - CO/Methane
  MQ135: '#ec4899', // Pink - Air Quality
  SHTC3_TEMP: '#f97316', // Orange - Temperature
  SHTC3_HUMIDITY: '#0284c7', // Sky Blue - Humidity
};

const SENSOR_LABELS = {
  MQ2: 'MQ-2 Smoke/LPG',
  MQ4: 'MQ-4 Methane',
  MQ5: 'MQ-5 Nat Gas',
  MQ6: 'MQ-6 LPG',
  MQ7: 'MQ-7 CO',
  MQ9B: 'MQ-9B CO/CH4',
  MQ135: 'MQ-135 Air Quality',
  SHTC3_TEMP: 'Temperature (°C)',
  SHTC3_HUMIDITY: 'Humidity (%)',
};

const SENSOR_FALLBACK_COLOR = '#6b7280';

export default function SensorsOverview() {
  const sensorHistory = useDashboardStore((state) => state.sensorHistory);

  const sensorKeys = useMemo(() => {
    if (!sensorHistory || sensorHistory.length === 0) return [];
    const keys = new Set();
    for (const point of sensorHistory) {
      for (const key of Object.keys(point)) {
        if (key !== 'time' && key !== 'device_id') keys.add(key);
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
      <div className="flex flex-col items-center justify-center h-full min-h-[220px] gap-3">
        <Activity className="w-8 h-8 opacity-20 animate-pulse text-[var(--ifrit-text-muted)]" />
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
    <div className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
          <defs>
            {sensorKeys.map((key) => {
              const color = SENSOR_COLORS[key] || SENSOR_FALLBACK_COLOR;
              return (
                <linearGradient key={`grad-${key}`} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.15}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.01}/>
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ifrit-border)" opacity={0.15} />
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
            formatter={(value, name) => [value, SENSOR_LABELS[name] || name]}
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
            formatter={(value) => SENSOR_LABELS[value] || value}
            wrapperStyle={{ fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", paddingBottom: '12px' }}
          />
          {sensorKeys.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={SENSOR_COLORS[key] || SENSOR_FALLBACK_COLOR}
              fill={`url(#grad-${key})`}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 1 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
