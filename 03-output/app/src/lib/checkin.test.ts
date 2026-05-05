import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { currentDayN } from "./checkin";

describe("currentDayN", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 1 right after opt-in", () => {
    const now = new Date("2026-05-05T10:00:00Z");
    vi.setSystemTime(now);
    expect(currentDayN("2026-05-05T09:00:00Z")).toBe(1);
  });

  it("returns 1 within first 24h", () => {
    const now = new Date("2026-05-06T08:59:59Z");
    vi.setSystemTime(now);
    expect(currentDayN("2026-05-05T09:00:00Z")).toBe(1);
  });

  it("returns 2 at 24h+1s", () => {
    const now = new Date("2026-05-06T09:00:01Z");
    vi.setSystemTime(now);
    expect(currentDayN("2026-05-05T09:00:00Z")).toBe(2);
  });

  it("returns 14 on day 14", () => {
    const now = new Date("2026-05-18T10:00:00Z"); // 13d 1h after
    vi.setSystemTime(now);
    expect(currentDayN("2026-05-05T09:00:00Z")).toBe(14);
  });

  it("returns 0 (invalid) past day 14", () => {
    const now = new Date("2026-05-19T10:00:00Z"); // 14d 1h after
    vi.setSystemTime(now);
    expect(currentDayN("2026-05-05T09:00:00Z")).toBe(0);
  });

  it("returns 0 for future opted_in_at (clock skew)", () => {
    const now = new Date("2026-05-05T09:00:00Z");
    vi.setSystemTime(now);
    expect(currentDayN("2026-05-05T10:00:00Z")).toBe(0);
  });
});
