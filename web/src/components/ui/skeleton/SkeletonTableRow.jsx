import * as React from "react";
import { SkeletonText } from "./SkeletonText";
import { cn } from "@/lib/utils";

/**
 * Table row skeleton component.
 * Renders a table row with specified column widths.
 *
 * @param {object} props
 * @param {string[]} [props.columns=['w-full']] - Array of Tailwind width classes for each column
 * @param {string} [props.className] - Additional CSS classes for the row
 * @param {number} [props.delay=0] - Base animation delay (in seconds)
 * @param {number} [props.staggerDelay=0.1] - Delay increment per column (in seconds)
 */
function SkeletonTableRow({
  columns = ["w-full"],
  className,
  delay = 0,
  staggerDelay = 0.1,
  ...props
}) {
  // Generate staggered delays for columns
  const columnDelays = React.useMemo(
    () =>
      columns.map((_, i) => delay + staggerDelay * i),
    [columns.length, delay, staggerDelay]
  );

  return (
    <div
      className={cn(
        "flex items-center h-12 border-b border-[var(--ifrit-border)] last:border-b-0",
        className
      )}
      {...props}
    >
      {columns.map((width, index) => (
        <div
          key={index}
          className="px-2 first:pl-0 last:pr-0"
          style={{ width }}
        >
          <SkeletonText
            size="sm"
            delay={columnDelays[index]}
            className="h-3"
          />
        </div>
      ))}
    </div>
  );
}

export { SkeletonTableRow };