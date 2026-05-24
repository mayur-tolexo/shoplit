"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealOnScrollProps {
  children: ReactNode;
  /** Stagger order — higher = more delay before fade-in. Cap at ~8 to avoid waits feeling laggy. */
  index?: number;
}

// Scroll-triggered fade-up reveal. Honors prefers-reduced-motion by
// rendering children directly (no animation) when the user has set it.
export function RevealOnScroll({ children, index = 0 }: RevealOnScrollProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <>{children}</>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2, margin: "0px 0px -80px 0px" }}
      transition={{
        duration: 0.5,
        delay: Math.min(index, 8) * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
