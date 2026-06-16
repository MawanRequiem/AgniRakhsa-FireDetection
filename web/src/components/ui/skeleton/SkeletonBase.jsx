import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Base animated skeleton wrapper using Framer Motion.
 * Provides a pulsing opacity animation that can wrap any content.
 *
 * @param {object} props
 * @param {string} [props.className] - Additional CSS classes
 * @param {React.ReactNode} [props.children] - Content to wrap
 * @param {number} [props.delay=0] - Delay before animation starts (in seconds)
 * @param {'easeInOut' | 'linear' | 'easeIn' | 'easeOut'} [props.ease='easeInOut'] - Animation easing
 * @param {number} [props.duration=1.5] - Animation duration (in seconds)
 */
function SkeletonBase({
  className,
  children,
  delay = 0,
  ease = "easeInOut",
  duration = 1.5,
  ...props
}) {
  return (
    <motion.div
      className={cn(
        "bg-[var(--ifrit-bg-tertiary)]",
        className
      )}
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{
        duration,
        repeat: Infinity,
        ease,
        delay,
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export { SkeletonBase };