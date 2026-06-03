import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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

const FALLBACK_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#eab308', '#a855f7', '#f43f5e', '#0ea5e9'];

function getColor(key, index) {
  const matchedKey = Object.keys(SENSOR_COLORS).find(k => k.toLowerCase() === key.toLowerCase());
  return matchedKey ? SENSOR_COLORS[matchedKey] : FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--ifrit-bg-tertiary)',
        borderColor: 'var(--ifrit-border)',
      }}
    >
      <p className="font-mono mb-1" style={{ color: 'var(--ifrit-text-muted)' }}>{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span style={{ color: 'var(--ifrit-text-secondary)' }}>{entry.dataKey}:</span>
          <span className="font-mono font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SensorChart({ data, sensors = [], height = 280 }) {
  const hasRawSensor = sensors.some(key => key.toLowerCase().includes('flame'));

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
        <LineChart data={data} margin={{ top: 5, right: hasRawSensor ? -10 : 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ifrit-border)" opacity={0.4} />
          <XAxis
            dataKey="time"
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
          <Tooltip content={<CustomTooltip />} />
          {sensors.map((key, index) => {
            const isRaw = key.toLowerCase().includes('flame');
            return (
              <Line
                key={key}
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
