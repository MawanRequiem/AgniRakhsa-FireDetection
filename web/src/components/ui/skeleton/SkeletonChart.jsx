import * as React from "react";
import { SkeletonBase } from "./SkeletonBase";
import { cn } from "@/lib/utils";

/**
 * Chart placeholder skeleton.
 * Renders a bar or line chart placeholder.
 *
 * @param {object} props
 * @param {'bar' | 'line'} [props.type='bar'] - Chart type
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.delay=0] - Animation delay (in seconds)
 * @param {number} [props.barCount=7] - Number of bars for bar chart type
 */
function SkeletonChart({
  type = "bar",
  className,
  delay = 0,
  barCount = 7,
  ...props
}) {
  // Random heights for bars to simulate real chart appearance
  const barHeights = React.useMemo(
    () =>
      Array.from({ length: barCount }, () => {
        const heights = ["h-16", "h-24", "h-20", "h-28", "h-18", "h-32", "h-12", "h-24"];
        return heights[Math.floor(Math.random() * heights.length)];
      }),
    [barCount]
  );

  return (
    <div
      className={cn(
        "h-[280px] w-full rounded-lg border border-[var(--ifrit-border)] bg-[var(--ifrit-bg-primary)] p-4",
        className
      )}
      {...props}
    >
      {type === "bar" ? (
        // Bar chart placeholder
        <div className="h-full flex items-end justify-between gap-2">
          {barHeights.map((height, index) => (
            <SkeletonBase
              key={index}
              className={cn("flex-1 rounded-t-md min-w-4", height)}
              delay={delay + index * 0.05}
            />
          ))}
        </div>
      ) : (
        // Line chart placeholder
        <div className="h-full relative">
          <svg
            className="w-full h-full"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            <line
              x1="0"
              y1="25"
              x2="200"
              y2="25"
              stroke="var(--ifrit-border)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <line
              x1="0"
              y1="50"
              x2="200"
              y2="50"
              stroke="var(--ifrit-border)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />
            <line
              x1="0"
              y1="75"
              x2="200"
              y2="75"
              stroke="var(--ifrit-border)"
              strokeWidth="0.5"
              strokeDasharray="2,2"
            />

            {/* Animated wavy path */}
            <motion.path
              d="M0,60 Q25,40 50,55 T100,35 T150,50 T200,30"
              fill="none"
              stroke="var(--ifrit-text-muted)"
              strokeWidth="2"
              strokeLinecap="round"
              opacity={0.5}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay,
              }}
            />

            {/* Animated dots along the path */}
            {[
              { cx: 50, cy: 55 },
              { cx: 100, cy: 35 },
              { cx: 150, cy: 50 },
            ].map((point, index) => (
              <motion.circle
                key={index}
                cx={point.cx}
                cy={point.cy}
                r="3"
                fill="var(--ifrit-text-muted)"
                opacity={0.5}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: delay + index * 0.15,
                }}
              />
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}

export { SkeletonChart };