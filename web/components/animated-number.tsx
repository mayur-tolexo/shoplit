"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  /** Animation duration in ms. Default 900. */
  duration?: number;
  className?: string;
}

// Tweens from 0 to `value` over `duration` on mount. Skips the animation
// entirely when prefers-reduced-motion is set. Uses requestAnimationFrame
// so it's smooth, frame-pacing-aware, and dependency-free.
export function AnimatedNumber({
  value,
  duration = 900,
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      // If `value` later changes, snap-update (don't re-animate to avoid
      // flicker on dashboard refreshes).
      setDisplay(value);
      return;
    }
    startedRef.current = true;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = value;
    // ease-out-cubic
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const current = Math.round(from + (to - from) * ease(t));
      setDisplay(current);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className={className}>{display.toLocaleString()}</span>;
}
