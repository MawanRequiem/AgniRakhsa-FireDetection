import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const lineColors = {
  co: '#F59E0B',
  lpg: '#60A5FA',
  smoke: '#A78BFA',
  cng: '#34D399',
  flame: '#F87171',
};

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
          <span style={{ color: 'var(--agni-text-secondary)' }}>{entry.dataKey.toUpperCase()}:</span>
          <span className="font-mono font-medium" style={{ color: 'var(--agni-text-primary)' }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function SensorChart({ data, sensors = ['co', 'smoke', 'lpg'], height = 280 }) {
  return (
    <div
      className="rounded-md border p-4"
      style={{
        backgroundColor: 'var(--agni-bg-tertiary)',
        borderColor: 'var(--agni-border)',
      }}
    >
      <h3 className="text-xs font-medium uppercase tracking-wider mb-4" style={{ color: 'var(--agni-text-muted)' }}>
        Sensor Trends (30 min)
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--agni-border)" opacity={0.4} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: 'var(--agni-text-muted)', fontFamily: 'JetBrains Mono' }}
            interval={9}
            axisLine={{ stroke: 'var(--agni-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--agni-text-muted)', fontFamily: 'JetBrains Mono' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {sensors.map(key => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={lineColors[key]}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: lineColors[key] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
