import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { shouldPenalize } from "./penalty";

describe("shouldPenalize", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not penalize when fewer than 5 days missed mid-period", () => {
    // opted in 5 days ago (currentDayN = 6), last checkin day 4 → missed 2 days
    vi.setSystemTime(new Date("2026-05-11T10:00:00Z"));
    expect(shouldPenalize("2026-05-05T09:00:00Z", 4, 4)).toBe(false);
  });

  it("penalizes when 5 consecutive days missed", () => {
    // opted in 10 days ago (currentDayN = 11 → invalid?)... within 14
    vi.setSystemTime(new Date("2026-05-15T10:00:00Z")); // 10d after
    // currentDayN = 10 + 1 = 11
    // last checkin day 6 → 11 - 6 = 5 missed
    expect(shouldPenalize("2026-05-05T09:00:00Z", 6, 6)).toBe(true);
  });

  it("penalizes when never checked in after 5 days", () => {
    // opted in 5 days ago, never checked in (last=0, count=0). currentDayN = 6.
    vi.setSystemTime(new Date("2026-05-11T10:00:00Z"));
    expect(shouldPenalize("2026-05-05T09:00:00Z", 0, 0)).toBe(true);
  });

  it("does not penalize on day 1 even with no checkins", () => {
    vi.setSystemTime(new Date("2026-05-05T10:00:00Z")); // 1h after
    expect(shouldPenalize("2026-05-05T09:00:00Z", 0, 0)).toBe(false);
  });

  it("penalizes after 14 days when not all 14 checked in", () => {
    // 15 days after, currentDayN = 0 (만료). 13 distinct checkins.
    vi.setSystemTime(new Date("2026-05-20T10:00:00Z"));
    expect(shouldPenalize("2026-05-05T09:00:00Z", 13, 14)).toBe(true);
  });

  it("does not penalize after 14 days if all 14 already checked in", () => {
    // Already auto-completed elsewhere; just guard.
    vi.setSystemTime(new Date("2026-05-20T10:00:00Z"));
    expect(shouldPenalize("2026-05-05T09:00:00Z", 14, 14)).toBe(false);
  });
});
