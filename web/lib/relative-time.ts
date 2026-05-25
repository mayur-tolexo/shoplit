// Pure, framework-agnostic relative-time formatter for feed timestamps. Kept
// out of any React component so the bucketing/boundary logic is testable in the
// repo's node-environment vitest (no DOM, no clock mocking needed — `now` is
// injectable).
//
// Buckets: <60s "just now"; <60m "Nm ago"; <24h "Nh ago"; <7d "Nd ago"; else a
// short date "Mar 4" (with the year appended when it differs from `now`'s year).

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  // Defensive: an unparseable ISO string falls back to the raw value rather
  // than rendering "NaNm ago".
  if (Number.isNaN(then.getTime())) return iso;

  const diffSec = Math.floor((now.getTime() - then.getTime()) / 1000);

  // Future or clock-skew timestamps read as "just now" rather than negatives.
  if (diffSec < MINUTE) return "just now";
  if (diffSec < HOUR) return `${Math.floor(diffSec / MINUTE)}m ago`;
  if (diffSec < DAY) return `${Math.floor(diffSec / HOUR)}h ago`;
  if (diffSec < WEEK) return `${Math.floor(diffSec / DAY)}d ago`;

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
