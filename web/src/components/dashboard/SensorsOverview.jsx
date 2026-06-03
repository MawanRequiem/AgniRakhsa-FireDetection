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
  SHTC_TEMP: '#f97316',
  SHTC3_HUMIDITY: '#0284c7', // Sky Blue - Humidity
  SHTC3_HUM: '#0284c7',
  SHTC_HUM: '#0284c7',
  FLAME: '#F87171', // Light Red - Flame
  flame: '#F87171',
};

const SENSOR_LABELS = {
  MQ2: 'MQ-2 (Smoke/LPG)',
  MQ4: 'MQ-4 (Methane)',
  MQ5: 'MQ-5 (Natural Gas)',
  MQ6: 'MQ-6 (LPG)',
  MQ7: 'MQ-7 (CO)',
  MQ9B: 'MQ-9B (CO)',
  MQ135: 'MQ-135 (Air Quality)',
  SHTC3_TEMP: 'Temperature (°C)',
  SHTC_TEMP: 'Temperature (°C)',
  SHTC3_HUMIDITY: 'Humidity (%)',
  SHTC3_HUM: 'Humidity (%)',
  SHTC_HUM: 'Humidity (%)',
  FLAME: 'Flame (IR)',
  flame: 'Flame',
};

const SENSOR_FALLBACK_COLOR = '#6b7280';

const parseDateStr = (timeStr) => {
  if (!timeStr) return null;
  let normalized = timeStr;
  const twoDigitYearRegex = /^(\d{2})-(\d{2})-(\d{2})([T\s])/;
  if (twoDigitYearRegex.test(timeStr)) {
    normalized = '20' + timeStr;
  }
  normalized = normalized.replace(' ', 'T');
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

const getBucketTime = (timeStr, timeRange) => {
  const d = parseDateStr(timeStr);
  if (!d) return timeStr;
  
  if (timeRange === '1H') {
    // 1-minute bucket
    d.setSeconds(0, 0);
  } else if (timeRange === '24H') {
    // 5-minute bucket
    const mins = d.getMinutes();
    d.setMinutes(Math.floor(mins / 5) * 5, 0, 0);
  } else if (timeRange === '7D') {
    // 1-hour bucket
    d.setMinutes(0, 0, 0);
  } else {
    // '30D' -> 4-hour bucket
    d.setMinutes(0, 0, 0);
    const hours = d.getHours();
    d.setHours(Math.floor(hours / 4) * 4);
  }
  return d.toISOString();
};

const mergeChartData = (rawData, timeRange = '1H') => {
  if (!rawData || rawData.length === 0) return [];
  const map = new Map();
  for (const point of rawData) {
    if (!point.time) continue;
    
    const timeKey = getBucketTime(point.time, timeRange);
    
    if (!map.has(timeKey)) {
      map.set(timeKey, { ...point, time: timeKey });
    } else {
      const existing = map.get(timeKey);
      Object.keys(point).forEach(k => {
        if (k !== 'time' && k !== 'device_id') {
          if (existing[k] !== undefined) {
            const isDangerMetric = k.toLowerCase().includes('flame') || k.toLowerCase().includes('mq');
            if (isDangerMetric) {
              existing[k] = Math.max(existing[k], point[k]);
            } else {
              existing[k] = (existing[k] + point[k]) / 2;
            }
          } else {
            existing[k] = point[k];
          }
        }
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time.localeCompare(b.time));
};

function getColor(key) {
  const matchedKey = Object.keys(SENSOR_COLORS).find(k => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? SENSOR_COLORS[matchedKey] : SENSOR_FALLBACK_COLOR;
}

function getLabel(key) {
  const matchedKey = Object.keys(SENSOR_LABELS).find(k => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? SENSOR_LABELS[matchedKey] : key;
}

export default function SensorsOverview({ timeRange = '1H' }) {
  const sensorHistory = useDashboardStore((state) => state.sensorHistory);

  const mergedHistory = useMemo(() => mergeChartData(sensorHistory, timeRange), [sensorHistory, timeRange]);

  const sensorKeys = useMemo(() => {
    if (!mergedHistory || mergedHistory.length === 0) return [];
    const keys = new Set();
    for (const point of mergedHistory) {
      for (const key of Object.keys(point)) {
        if (key !== 'time' && key !== 'device_id') keys.add(key);
      }
    }
    return Array.from(keys);
  }, [mergedHistory]);

  const hasRawSensor = useMemo(() => {
    return sensorKeys.some(key => key.toLowerCase().includes('flame'));
  }, [sensorKeys]);

  const formatXAxisTick = (timeStr) => {
    const d = parseDateStr(timeStr);
    if (!d) return timeStr || '';
    
    if (timeRange === '1H' || timeRange === '24H') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    } else {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${day}/${month}`;
    }
  };

  const formatTooltipLabel = (timeStr) => {
    const d = parseDateStr(timeStr);
    if (!d) return timeStr || '';
    
    if (timeRange === '1H' || timeRange === '24H') {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } else {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      return `${day}/${month}/${year} ${time}`;
    }
  };

  if (!mergedHistory || mergedHistory.length === 0) {
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
        <AreaChart data={mergedHistory} margin={{ top: 5, right: hasRawSensor ? 35 : 10, left: -25, bottom: 0 }}>
          <defs>
            {sensorKeys.map((key) => {
              const color = getColor(key);
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
            tickFormatter={formatXAxisTick}
            tick={{ fill: 'var(--ifrit-text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
            stroke="var(--ifrit-border)"
            interval="preserveStartEnd"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fill: 'var(--ifrit-text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} 
            stroke="var(--ifrit-border)"
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            hide={!hasRawSensor}
            domain={[0, 4095]}
            tick={{ fill: 'var(--ifrit-text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }} 
            stroke="var(--ifrit-border)"
          />
          <Tooltip
            labelFormatter={formatTooltipLabel}
            formatter={(value, name) => [value, getLabel(name)]}
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
            iconType="circle"
            iconSize={6}
            formatter={(value) => getLabel(value)}
            wrapperStyle={{ 
              fontSize: '10px', 
              fontFamily: "'Outfit', sans-serif", 
              color: 'var(--ifrit-text-secondary)',
              paddingBottom: '12px'
            }}
          />
          {sensorKeys.map((key) => {
            const isRaw = key.toLowerCase().includes('flame');
            return (
              <Area
                key={key}
                name={getLabel(key)}
                type="monotone"
                dataKey={key}
                yAxisId={isRaw ? 'right' : 'left'}
                stroke={getColor(key)}
                fill={`url(#grad-${key})`}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 1 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
