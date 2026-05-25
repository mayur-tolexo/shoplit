// Pure summarizer for the dashboard insights. Splits the daily series into the
// last 7 days vs the prior 7 days and computes week-over-week deltas. Kept
// dependency-free and side-effect-free so it can be unit-tested in a node
// environment (see insights.test.ts) and reused by the InsightSummary view.

import type { DailyStat } from "./types";

export interface InsightSummary {
  viewsThisWeek: number;
  viewsPrevWeek: number;
  /** Week-over-week % change for views. `null` when the prior week was 0
   *  (no meaningful baseline → render "new", not a divide-by-zero). */
  viewsDeltaPct: number | null;
  clicksThisWeek: number;
  clicksPrevWeek: number;
  clicksDeltaPct: number | null;
}

function deltaPct(current: number, prev: number): number | null {
  // No baseline to compare against — the caller renders this as "new" rather
  // than an infinite/NaN percentage.
  if (prev === 0) return null;
  return Math.round(((current - prev) / prev) * 100);
}

// Summarize a daily series (any length; tolerant of short/empty arrays). The
// last 7 entries are "this week" and the 7 before those are "prev week"; if the
// array is shorter, the missing slots simply contribute 0.
export function summarizeDaily(daily: DailyStat[]): InsightSummary {
  const days = Array.isArray(daily) ? daily : [];
  const thisWeek = days.slice(-7);
  const prevWeek = days.slice(-14, -7);

  const sum = (rows: DailyStat[], key: "views" | "clicks") =>
    rows.reduce((acc, d) => acc + (d?.[key] ?? 0), 0);

  const viewsThisWeek = sum(thisWeek, "views");
  const viewsPrevWeek = sum(prevWeek, "views");
  const clicksThisWeek = sum(thisWeek, "clicks");
  const clicksPrevWeek = sum(prevWeek, "clicks");

  return {
    viewsThisWeek,
    viewsPrevWeek,
    viewsDeltaPct: deltaPct(viewsThisWeek, viewsPrevWeek),
    clicksThisWeek,
    clicksPrevWeek,
    clicksDeltaPct: deltaPct(clicksThisWeek, clicksPrevWeek),
  };
}
