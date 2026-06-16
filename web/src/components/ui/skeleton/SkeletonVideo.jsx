import * as React from "react";
import { SkeletonBase } from "./SkeletonBase";
import { cn } from "@/lib/utils";

/**
 * Video/camera feed placeholder skeleton.
 * Renders an aspect-video container with subtle play icon hint.
 *
 * @param {object} props
 * @param {string} [props.className] - Additional CSS classes
 * @param {number} [props.delay=0] - Animation delay (in seconds)
 * @param {boolean} [props.showPlayIcon=true] - Whether to show subtle play icon
 */
function SkeletonVideo({
  className,
  delay = 0,
  showPlayIcon = true,
  ...props
}) {
  return (
    <SkeletonBase
      className={cn(
        "aspect-video w-full rounded-lg border border-[var(--ifrit-border)] bg-[var(--ifrit-bg-tertiary)] relative overflow-hidden",
        className
      )}
      delay={delay}
      {...props}
    >
      {/* Subtle play icon placeholder */}
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-12 h-12 text-[var(--ifrit-text-muted)] opacity-20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </SkeletonBase>
  );
}

export { SkeletonVideo };