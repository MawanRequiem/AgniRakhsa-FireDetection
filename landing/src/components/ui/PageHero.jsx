import EmberCanvas from '@/components/ui/EmberCanvas';

export default function PageHero({ title, subtitle }) {
  return (
    <section className="relative section-dark min-h-[50vh] flex items-center justify-center overflow-hidden">
      <EmberCanvas className="opacity-40" />

      {/* Gradient overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 120%, oklch(0.35 0.15 25 / 0.15), transparent 70%)',
        }}
        aria-hidden="true"
      />

      <div className="container-wide relative z-10 py-32 text-center">
        <h1 className="text-5xl mb-4">{title}</h1>
        <p className="text-lg text-text-on-dark-muted max-w-2xl mx-auto">{subtitle}</p>
      </div>
    </section>
  );
}
