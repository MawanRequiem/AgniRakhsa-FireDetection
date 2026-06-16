import * as React from "react";
import { SkeletonBase } from "./SkeletonBase";
import { cn } from "@/lib/utils";

/**
 * Text line skeleton component.
 * Renders a rounded rectangle that mimics text lines.
 *
 * @param {object} props
 * @param {'sm' | 'md' | 'lg'} [props.size='md'] - Text line height size
 * @param {string} [props.width] - Tailwind width class (e.g., "w-24", "w-full")
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.delay=0] - Animation delay (in seconds)
 */
function SkeletonText({
  size = "md",
  width,
  className,
  delay = 0,
  ...props
}) {
  const sizeClasses = {
    sm: "h-2",
    md: "h-3",
    lg: "h-4",
  };

  return (
    <SkeletonBase
      className={cn(
        "w-full rounded-full",
        sizeClasses[size],
        className
      )}
      style={width ? { width } : undefined}
      delay={delay}
      {...props}
    />
  );
}

export { SkeletonText };