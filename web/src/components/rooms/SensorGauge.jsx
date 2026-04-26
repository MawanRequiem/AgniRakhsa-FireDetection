export default function SensorGauge({ type, value, unit, safeMax, warnMax }) {
  // Calculate percentage (cap at 100 for display)
  // We use warnMax * 1.5 as the absolute max for the visual bar 
  // so there's room to show values exceeding the warning threshold
  const visualMax = warnMax * 1.5;
  const percentage = Math.min((value / visualMax) * 100, 100);
  
  const safePct = (safeMax / visualMax) * 100;
  const warnPct = (warnMax / visualMax) * 100;

  const isFire = value > warnMax;
  const isWarning = value > safeMax && value <= warnMax;
  
  const fillColor = isFire ? 'var(--ifrit-fire)' 
                  : isWarning ? 'var(--ifrit-warning)' 
                  : 'var(--ifrit-safe)';

  return (
    <div className="mb-4">
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-sm font-medium" style={{ color: 'var(--ifrit-text-primary)' }}>
          {type}
        </span>
        <div className="flex items-baseline gap-1">
          <span 
            className="text-lg font-bold font-mono" 
            style={{ color: fillColor }}
          >
            {value}
          </span>
          <span className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
            {unit}
          </span>
        </div>
      </div>
      
      <div 
        className="relative h-2.5 rounded-full w-full overflow-hidden"
        style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}
      >
        <div 
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${percentage}%`, 
            backgroundColor: fillColor 
          }}
        />
      </div>
      
      {/* Threshold markers */}
      <div className="relative w-full h-4 mt-1">
        <div 
          className="absolute top-0 flex flex-col items-center -ml-3"
          style={{ left: `${safePct}%` }}
        >
          <div className="w-0.5 h-1.5 bg-[var(--ifrit-border)] mb-0.5" />
          <span className="text-[9px] font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>{safeMax}</span>
        </div>
        <div 
          className="absolute top-0 flex flex-col items-center -ml-3"
          style={{ left: `${warnPct}%` }}
        >
          <div className="w-0.5 h-1.5 bg-[var(--ifrit-fire)] opacity-50 mb-0.5" />
          <span className="text-[9px] font-mono" style={{ color: 'var(--ifrit-text-muted)' }}>{warnMax}</span>
        </div>
      </div>
    </div>
  );
}
