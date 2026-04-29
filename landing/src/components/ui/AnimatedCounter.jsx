import { useEffect, useRef, useState } from 'react';

export default function AnimatedCounter({
  value,
  suffix = '',
  duration = 2000,
  className = '',
}) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.unobserve(el);

          const start = performance.now();
          const isFloat = value % 1 !== 0;

          function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out-quart curve
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = eased * value;

            setCount(isFloat ? parseFloat(current.toFixed(1)) : Math.floor(current));

            if (progress < 1) {
              requestAnimationFrame(tick);
            }
          }

          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={`font-display tabular-nums ${className}`}>
      {count}{suffix}
    </span>
  );
}
