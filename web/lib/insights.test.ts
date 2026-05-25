import { describe, expect, it } from "vitest";
import { summarizeDaily } from "./insights";
import type { DailyStat } from "./types";

// Build a 14-day series from two 7-number arrays (prev week then this week).
function series(prev: number[], curr: number[]): DailyStat[] {
  return [...prev, ...curr].map((views, i) => ({
    date: `2026-05-${String(i + 1).padStart(2, "0")}`,
    views,
    clicks: views * 2, // deterministic relation so clicks math is checkable
  }));
}

describe("summarizeDaily", () => {
  it("splits the last 7 days vs the prior 7", () => {
    const s = summarizeDaily(series([1, 1, 1, 1, 1, 1, 1], [2, 2, 2, 2, 2, 2, 2]));
    expect(s.viewsPrevWeek).toBe(7);
    expect(s.viewsThisWeek).toBe(14);
    expect(s.clicksPrevWeek).toBe(14);
    expect(s.clicksThisWeek).toBe(28);
  });

  it("computes a positive week-over-week delta %", () => {
    // prev=10, this=15 → +50%
    const s = summarizeDaily(series([10, 0, 0, 0, 0, 0, 0], [15, 0, 0, 0, 0, 0, 0]));
    expect(s.viewsPrevWeek).toBe(10);
    expect(s.viewsThisWeek).toBe(15);
    expect(s.viewsDeltaPct).toBe(50);
  });

  it("computes a negative delta % and rounds", () => {
    // prev=30, this=20 → -33.33% → -33
    const s = summarizeDaily(series([30, 0, 0, 0, 0, 0, 0], [20, 0, 0, 0, 0, 0, 0]));
    expect(s.viewsDeltaPct).toBe(-33);
  });

  it("returns null delta when the prior week was zero (no baseline)", () => {
    const s = summarizeDaily(series([0, 0, 0, 0, 0, 0, 0], [5, 0, 0, 0, 0, 0, 0]));
    expect(s.viewsPrevWeek).toBe(0);
    expect(s.viewsThisWeek).toBe(5);
    expect(s.viewsDeltaPct).toBeNull();
    expect(s.clicksDeltaPct).toBeNull();
  });

  it("is safe on an empty array", () => {
    const s = summarizeDaily([]);
    expect(s).toEqual({
      viewsThisWeek: 0,
      viewsPrevWeek: 0,
      viewsDeltaPct: null,
      clicksThisWeek: 0,
      clicksPrevWeek: 0,
      clicksDeltaPct: null,
    });
  });

  it("handles a short array (< 7 days) — everything counts toward this week", () => {
    const days: DailyStat[] = [
      { date: "2026-05-01", views: 3, clicks: 1 },
      { date: "2026-05-02", views: 4, clicks: 2 },
    ];
    const s = summarizeDaily(days);
    expect(s.viewsThisWeek).toBe(7);
    expect(s.viewsPrevWeek).toBe(0);
    expect(s.clicksThisWeek).toBe(3);
    expect(s.viewsDeltaPct).toBeNull();
  });

  it("handles an array between 8 and 13 days (partial prev week)", () => {
    // 10 days: last 7 are this week, first 3 are prev week.
    const views = [1, 1, 1, 2, 2, 2, 2, 2, 2, 2]; // prev(0..2)=3, this(3..9)=14
    const days = views.map((v, i) => ({ date: `2026-05-${i + 1}`, views: v, clicks: 0 }));
    const s = summarizeDaily(days);
    expect(s.viewsPrevWeek).toBe(3);
    expect(s.viewsThisWeek).toBe(14);
  });
});
