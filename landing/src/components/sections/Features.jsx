import { useLanguage } from '@/hooks/useLanguage';
import ScrollReveal from '@/components/ui/ScrollReveal';
import SectionHeading from '@/components/ui/SectionHeading';

const featureVisuals = [
  // AI Vision — large hero-style visual
  (feature) => (
    <div className="relative rounded-[var(--radius-lg)] overflow-hidden bg-dark-surface aspect-video flex items-center justify-center group">
      {/* Simulated CCTV overlay */}
      <div className="absolute inset-0 bg-dark-bg/80" />
      <div className="absolute inset-4 border border-ifrit-red/20 rounded-[var(--radius-md)]">
        {/* Scan line animation */}
        <div className="absolute top-0 left-0 right-0 h-px bg-ifrit-red/40 animate-[scanline_3s_ease-in-out_infinite]" />
        {/* Corner brackets */}
        <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-ifrit-red/60" />
        <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-ifrit-red/60" />
        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-ifrit-red/60" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-ifrit-red/60" />
      </div>
      {/* Detection zones */}
      <div className="relative z-10 flex flex-col items-center gap-3 text-center px-8">
        <div className="w-16 h-16 rounded-full border-2 border-ifrit-red/50 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-ifrit-red animate-pulse" />
        </div>
        <span className="font-display text-xs font-semibold tracking-[0.15em] text-ifrit-red uppercase">
          {feature.tag}
        </span>
      </div>
      {/* Rec indicator */}
      <div className="absolute top-6 right-6 flex items-center gap-2 text-xs text-text-on-dark-muted font-body">
        <div className="w-2 h-2 rounded-full bg-ifrit-red animate-pulse" />
        REC
      </div>
    </div>
  ),

  // Sensor Fusion — data readout style
  (feature) => (
    <div className="relative rounded-[var(--radius-lg)] overflow-hidden bg-dark-surface p-6 flex flex-col gap-4">
      <span className="font-display text-xs font-semibold tracking-[0.15em] text-ifrit-amber uppercase">
        {feature.tag}
      </span>
      {/* Sensor readouts */}
      {[
        { label: 'MQ-2 Gas', value: '12.4 ppm', status: 'normal' },
        { label: 'Temperature', value: '34.2°C', status: 'warning' },
        { label: 'Humidity', value: '67%', status: 'normal' },
        { label: 'CO Level', value: '8.1 ppm', status: 'normal' },
      ].map((sensor, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-dark-border/30 last:border-0">
          <span className="text-sm text-text-on-dark-muted font-body">{sensor.label}</span>
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-semibold text-text-on-dark tabular-nums">
              {sensor.value}
            </span>
            <div className={`w-2 h-2 rounded-full ${
              sensor.status === 'warning' ? 'bg-ifrit-amber animate-pulse' : 'bg-green-500'
            }`} />
          </div>
        </div>
      ))}
      {/* Risk meter */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-text-on-dark-muted mb-1">
          <span>Risk Assessment</span>
          <span className="text-ifrit-amber font-semibold">LOW-MED</span>
        </div>
        <div className="h-1.5 bg-dark-border/30 rounded-full overflow-hidden">
          <div className="h-full w-[35%] bg-ifrit-amber rounded-full transition-all duration-1000" />
        </div>
      </div>
    </div>
  ),

  // Real-time Alerting — notification mockup
  (feature) => (
    <div className="relative rounded-[var(--radius-lg)] overflow-hidden bg-dark-surface p-6 flex flex-col gap-3">
      <span className="font-display text-xs font-semibold tracking-[0.15em] text-green-400 uppercase">
        {feature.tag}
      </span>
      {/* Alert notifications */}
      {[
        { time: '14:32:01', msg: '⚠️ Smoke detected — Zone B3', type: 'alert' },
        { time: '14:32:03', msg: '📱 WhatsApp alert sent to 3 contacts', type: 'sent' },
        { time: '14:32:05', msg: '🖥️ Dashboard updated — live cam active', type: 'info' },
        { time: '14:32:08', msg: '✅ Security team notified — ETA 90s', type: 'success' },
      ].map((notif, i) => (
        <div
          key={i}
          className={`
            flex gap-3 p-3 rounded-[var(--radius-md)]
            ${notif.type === 'alert'
              ? 'bg-ifrit-red/10 border border-ifrit-red/20'
              : 'bg-dark-bg/50'
            }
          `.replace(/\s+/g, ' ').trim()}
        >
          <span className="text-xs text-text-on-dark-muted font-body tabular-nums whitespace-nowrap mt-0.5">
            {notif.time}
          </span>
          <span className="text-sm text-text-on-dark font-body">{notif.msg}</span>
        </div>
      ))}
    </div>
  ),
];

export default function Features() {
  const { t } = useLanguage();
  const features = t('features.items');

  return (
    <section className="section-light py-24 md:py-32" id="features">
      <div className="container-wide">
        <SectionHeading
          label={t('features.label')}
          title={t('features.title')}
          align="center"
        />

        <div className="mt-20 flex flex-col gap-24">
          {features.map((feature, i) => {
            const isReversed = i % 2 === 1;
            const Visual = featureVisuals[i];

            return (
              <div
                key={i}
                className={`
                  grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center
                  ${isReversed ? 'lg:direction-rtl' : ''}
                `.replace(/\s+/g, ' ').trim()}
                style={isReversed ? { direction: 'rtl' } : {}}
              >
                {/* Visual */}
                <ScrollReveal delay={0}>
                  <div style={{ direction: 'ltr' }}>
                    {Visual(feature)}
                  </div>
                </ScrollReveal>

                {/* Text */}
                <ScrollReveal delay={150}>
                  <div className="flex flex-col gap-4" style={{ direction: 'ltr' }}>
                    <span className="font-display text-xs font-semibold tracking-[0.2em] uppercase text-ifrit-red">
                      0{i + 1}
                    </span>
                    <h3 className="text-3xl lg:text-4xl">{feature.title}</h3>
                    <p className="text-text-on-light-muted text-lg leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </ScrollReveal>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scanline animation keyframe */}
      <style>{`
        @keyframes scanline {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(calc(100% + 200px)); }
        }
      `}</style>
    </section>
  );
}
