import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

// Extended color palette for all possible sensor types
const SENSOR_COLORS = {
  MQ2: '#F59E0B',    // amber - Smoke / LPG
  MQ4: '#3b82f6',    // blue - Methane
  MQ5: '#8b5cf6',    // violet - Natural Gas / LPG
  MQ6: '#60A5FA',    // blue-light - LPG
  MQ7: '#ef4444',    // red - Carbon Monoxide
  MQ9B: '#06b6d4',   // cyan - CO + Methane
  MQ135: '#ec4899',  // pink - Air Quality
  SHTC_TEMP: '#f97316',      // orange - Temp
  SHTC_HUM: '#10b981',       // emerald - Hum
  FLAME: '#F87171',          // red-light - Flame
  SHTC3_TEMP: '#f97316',     // orange
  SHTC3_HUMIDITY: '#10b981', // emerald
  // Legacy keys for backwards compat
  co: '#F59E0B',
  lpg: '#60A5FA',
  smoke: '#A78BFA',
  cng: '#34D399',
  flame: '#F87171',
};

// Friendly labels for sensors
const SENSOR_LABELS = {
  SHTC_TEMP: 'Temperature',
  SHTC3_TEMP: 'Temperature',
  SHTC_HUM: 'Humidity',
  SHTC3_HUMIDITY: 'Humidity',
  FLAME: 'Flame (IR)',
  MQ2: 'MQ-2 (Smoke/LPG)',
  MQ4: 'MQ-4 (Methane)',
  MQ5: 'MQ-5 (Natural Gas)',
  MQ6: 'MQ-6 (LPG)',
  MQ7: 'MQ-7 (CO)',
  MQ9B: 'MQ-9B (CO)',
  MQ135: 'MQ-135 (Air Quality)',
  co: 'CO',
  lpg: 'LPG',
  smoke: 'Smoke',
  cng: 'CNG',
  flame: 'Flame',
};

const FALLBACK_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#eab308', '#a855f7', '#f43f5e', '#0ea5e9'];

function getColor(key, index) {
  const matchedKey = Object.keys(SENSOR_COLORS).find(k => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? SENSOR_COLORS[matchedKey] : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function getLabel(key) {
  const matchedKey = Object.keys(SENSOR_LABELS).find(k => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? SENSOR_LABELS[matchedKey] : key;
}

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

const mergeChartData = (rawData) => {
  if (!rawData || rawData.length === 0) return [];
  const map = new Map();
  for (const point of rawData) {
    if (!point.time) continue;
    
    let timeKey = point.time;
    const twoDigitYearRegex = /^(\d{2})-(\d{2})-(\d{2})([T\s])/;
    if (twoDigitYearRegex.test(timeKey)) {
      timeKey = '20' + timeKey;
    }
    timeKey = timeKey.replace(' ', 'T');
    
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

const CustomTooltip = ({ active, payload, label, timeRange = '1H' }) => {
  if (!active || !payload?.length) return null;

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

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--ifrit-bg-tertiary)',
        borderColor: 'var(--ifrit-border)',
      }}
    >
      <p className="font-mono mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>{formatTooltipLabel(label)}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span style={{ color: 'var(--ifrit-text-secondary)' }}>{entry.name || entry.dataKey}:</span>
          <span className="font-mono font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SensorChart({ data, sensors = [], timeRange = '1H', height = 280 }) {
  const mergedData = useMemo(() => mergeChartData(data), [data]);

  const chartSensors = useMemo(() => {
    const keys = new Set(sensors);
    for (const point of mergedData) {
      Object.keys(point).forEach(key => {
        if (key !== 'time' && key !== 'device_id') {
          keys.add(key);
        }
      });
    }
    return Array.from(keys);
  }, [mergedData, sensors]);

  const hasRawSensor = useMemo(() => {
    return chartSensors.some(key => key.toLowerCase().includes('flame'));
  }, [chartSensors]);

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

  return (
    <div
      className="rounded-md border p-4"
      style={{
        backgroundColor: 'var(--ifrit-bg-tertiary)',
        borderColor: 'var(--ifrit-border)',
      }}
    >
      <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--ifrit-text-muted)' }}>
        Sensor Trends
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={mergedData} margin={{ top: 5, right: hasRawSensor ? 35 : 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ifrit-border)" opacity={0.4} />
          <XAxis
            dataKey="time"
            tickFormatter={formatXAxisTick}
            tick={{ fontSize: 10, fill: 'var(--ifrit-text-muted)', fontFamily: 'monospace' }}
            interval="preserveStartEnd"
            axisLine={{ stroke: 'var(--ifrit-border)' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 10, fill: 'var(--ifrit-text-muted)', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            hide={!hasRawSensor}
            tick={{ fontSize: 10, fill: 'var(--ifrit-text-muted)', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
            domain={[0, 4095]}
          />
          <Tooltip content={<CustomTooltip timeRange={timeRange} />} />
          <Legend 
            verticalAlign="top"
            align="left"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-[11px] font-medium tracking-wide" style={{ color: 'var(--ifrit-text-secondary)', fontFamily: "'Outfit', sans-serif" }}>
                {getLabel(value)}
              </span>
            )}
            wrapperStyle={{ paddingBottom: '16px', paddingLeft: '10px' }}
          />
          {chartSensors.map((key, index) => {
            const isRaw = key.toLowerCase().includes('flame');
            return (
              <Line
                key={key}
                name={getLabel(key)}
                type="monotone"
                dataKey={key}
                yAxisId={isRaw ? 'right' : 'left'}
                stroke={getColor(key, index)}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: getColor(key, index) }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
