import { describe, it, expect } from "vitest";
import { relativeTime } from "./relative-time";

// Fixed reference clock so every case is deterministic regardless of the
// machine's wall clock or timezone.
const NOW = new Date("2026-05-25T12:00:00Z");

// Build an ISO string `seconds` before NOW.
function ago(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe("relativeTime", () => {
  it("returns 'just now' under a minute", () => {
    expect(relativeTime(ago(0), NOW)).toBe("just now");
    expect(relativeTime(ago(30), NOW)).toBe("just now");
    expect(relativeTime(ago(59), NOW)).toBe("just now");
  });

  it("returns minutes from the 60s boundary up to an hour", () => {
    expect(relativeTime(ago(60), NOW)).toBe("1m ago");
    expect(relativeTime(ago(5 * 60), NOW)).toBe("5m ago");
    expect(relativeTime(ago(59 * 60), NOW)).toBe("59m ago");
  });

  it("returns hours from the 60m boundary up to a day", () => {
    expect(relativeTime(ago(60 * 60), NOW)).toBe("1h ago");
    expect(relativeTime(ago(3 * 60 * 60), NOW)).toBe("3h ago");
    expect(relativeTime(ago(23 * 60 * 60), NOW)).toBe("23h ago");
  });

  it("returns days from the 24h boundary up to a week", () => {
    expect(relativeTime(ago(24 * 60 * 60), NOW)).toBe("1d ago");
    expect(relativeTime(ago(3 * 24 * 60 * 60), NOW)).toBe("3d ago");
    expect(relativeTime(ago(6 * 24 * 60 * 60), NOW)).toBe("6d ago");
  });

  it("returns a short date once older than a week (same year, no year shown)", () => {
    // 10 days before 2026-05-25 → 2026-05-15.
    expect(relativeTime(ago(10 * 24 * 60 * 60), NOW)).toBe("May 15");
  });

  it("at exactly 7 days it crosses into the dated bucket", () => {
    // 7 days before 2026-05-25 → 2026-05-18.
    expect(relativeTime(ago(7 * 24 * 60 * 60), NOW)).toBe("May 18");
  });

  it("includes the year when the timestamp is in a different year", () => {
    expect(relativeTime("2024-03-04T09:00:00Z", NOW)).toBe("Mar 4, 2024");
  });

  it("treats future/clock-skew timestamps as 'just now'", () => {
    expect(relativeTime(ago(-120), NOW)).toBe("just now");
  });

  it("falls back to the raw string for an unparseable input", () => {
    expect(relativeTime("not-a-date", NOW)).toBe("not-a-date");
  });
});
