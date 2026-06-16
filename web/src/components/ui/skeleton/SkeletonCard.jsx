import * as React from "react";
import { SkeletonBase } from "./SkeletonBase";
import { SkeletonText } from "./SkeletonText";
import { cn } from "@/lib/utils";

/**
 * Card-like container skeleton.
 * Renders a card placeholder with optional header, body lines, and footer.
 *
 * @param {object} props
 * @param {number} [props.lines=2] - Number of body text lines
 * @param {boolean} [props.hasHeader=false] - Whether to show header skeleton
 * @param {boolean} [props.hasFooter=false] - Whether to show footer skeleton
 * @param {string} [props.className] - Additional CSS classes for container
 * @param {number} [props.delay=0] - Base animation delay (in seconds)
 * @param {number} [props.staggerDelay=0.1] - Delay increment per line (in seconds)
 */
function SkeletonCard({
  lines = 2,
  hasHeader = false,
  hasFooter = false,
  className,
  delay = 0,
  staggerDelay = 0.1,
  ...props
}) {
  // Generate staggered delays for body lines
  const bodyDelays = React.useMemo(
    () =>
      Array.from({ length: lines }, (_, i) => delay + staggerDelay * (i + 1)),
    [lines, delay, staggerDelay]
  );

  return (
    <div
      className={cn(
        "rounded-xl border bg-[var(--ifrit-bg-primary)] border-[var(--ifrit-border)] overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Header */}
      {hasHeader && (
        <div className="px-4 pt-4 pb-3">
          <SkeletonText size="lg" delay={delay} />
        </div>
      )}

      {/* Body */}
      <div className={cn("px-4", hasHeader ? "pb-2" : "py-4", hasFooter ? "" : "pb-4")}>
        {bodyDelays.map((lineDelay, index) => (
          <div
            key={index}
            className={index > 0 ? "mt-2" : ""}
          >
            <SkeletonText
              size="md"
              delay={lineDelay}
              className={index === lines - 1 ? "w-3/4" : undefined}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      {hasFooter && (
        <div className="px-4 py-3 border-t border-[var(--ifrit-border)]">
          <SkeletonText size="sm" delay={delay + staggerDelay * (lines + 1)} />
        </div>
      )}
    </div>
  );
}

export { SkeletonCard };