import SkeletonText from './SkeletonText';
import SkeletonCard from './SkeletonCard';

/**
 * Full-page skeleton used as Suspense fallback for lazy-loaded routes.
 * Mimics the layout of a typical landing page (page hero + content grid)
 * to minimise layout shift and reinforce perceived performance.
 */
export default function PageSkeleton() {
  return (
    <div aria-busy="true" aria-live="polite">
      {/* Hero — dark */}
      <section className="section-dark py-24 md:py-32">
        <div className="container-wide max-w-4xl">
          <SkeletonText variant="dark" size="sm" width="w-32" className="mb-6" />
          <SkeletonText variant="dark" size="lg" width="w-3/4" className="mb-4" />
          <SkeletonText variant="dark" size="lg" width="w-1/2" className="mb-8" />
          <SkeletonText variant="dark" size="md" width="w-full" className="mb-2" />
          <SkeletonText variant="dark" size="md" width="w-5/6" />
        </div>
      </section>

      {/* Content — light, card grid */}
      <section className="section-light py-24 md:py-32">
        <div className="container-wide">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <SkeletonText variant="light" size="sm" width="w-32" className="mx-auto mb-4" />
            <SkeletonText variant="light" size="lg" width="w-2/3" className="mx-auto" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[0, 1, 2].map((i) => (
              <SkeletonCard
                key={i}
                variant="light"
                hasHeader
                lines={2}
                delay={i * 0.15}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
