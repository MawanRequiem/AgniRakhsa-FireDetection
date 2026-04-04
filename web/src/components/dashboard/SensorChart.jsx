import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// Extended color palette for all possible sensor types
const SENSOR_COLORS = {
  MQ2: '#F59E0B',
  MQ4: '#3b82f6',
  MQ6: '#8b5cf6',
  MQ9B: '#06b6d4',
  FLAME: '#ef4444',
  SHTC3_TEMP: '#f97316',
  SHTC3_HUMIDITY: '#10b981',
  // Legacy keys for backwards compat
  co: '#F59E0B',
  lpg: '#60A5FA',
  smoke: '#A78BFA',
  cng: '#34D399',
  flame: '#F87171',
};

const FALLBACK_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#eab308', '#a855f7', '#f43f5e', '#0ea5e9'];

function getColor(key, index) {
  return SENSOR_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs"
      style={{
        backgroundColor: 'var(--agni-bg-tertiary)',
        borderColor: 'var(--agni-border)',
      }}
    >
      <p className="font-mono mb-1" style={{ color: 'var(--agni-text-muted)' }}>{label}</p>
      {payload.map(entry => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span style={{ color: 'var(--agni-text-secondary)' }}>{entry.dataKey}:</span>
          <span className="font-mono font-medium" style={{ color: 'var(--agni-text-primary)' }}>
            {typeof entry.value === 'number' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SensorChart({ data, sensors = [], height = 280 }) {
  return (
    <div
      className="rounded-md border p-4"
      style={{
        backgroundColor: 'var(--agni-bg-tertiary)',
        borderColor: 'var(--agni-border)',
      }}
    >
      <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--agni-text-muted)' }}>
        Sensor Trends
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--agni-border)" opacity={0.4} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--agni-text-muted)', fontFamily: 'monospace' }}
            interval="preserveStartEnd"
            axisLine={{ stroke: 'var(--agni-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--agni-text-muted)', fontFamily: 'monospace' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {sensors.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={getColor(key, index)}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: getColor(key, index) }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
