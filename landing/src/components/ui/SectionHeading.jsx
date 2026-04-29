import ScrollReveal from './ScrollReveal';

export default function SectionHeading({
  label,
  title,
  description,
  align = 'left',
  dark = false,
}) {
  const isCenter = align === 'center';
  const mutedColor = dark ? 'text-text-on-dark-muted' : 'text-text-on-light-muted';

  const containerStyle = {
    maxWidth: '48rem',
    textAlign: isCenter ? 'center' : 'left',
    ...(isCenter ? { marginInline: 'auto' } : {}),
  };

  return (
    <div style={containerStyle}>
      {label && (
        <ScrollReveal>
          <span
            className="font-display text-ifrit-red"
            style={{
              display: 'inline-block',
              fontSize: '0.75rem',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '1rem',
            }}
          >
            {label}
          </span>
        </ScrollReveal>
      )}
      <ScrollReveal delay={80}>
        <h2>{title}</h2>
      </ScrollReveal>
      {description && (
        <ScrollReveal delay={160}>
          <p
            className={mutedColor}
            style={{
              fontSize: '1.125rem',
              lineHeight: 1.65,
              marginTop: '1rem',
            }}
          >
            {description}
          </p>
        </ScrollReveal>
      )}
    </div>
  );
}
