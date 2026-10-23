import { describe, expect, it } from "vitest";
import { closedKey, hideKey, hideUntilFrom, shouldShowNotice } from "./notice-popup";

// 2026-10-23 12:00 KST
const NOW = Date.parse("2026-10-23T12:00:00+09:00");
const SHOW_UNTIL = "2026-11-06T00:00:00+09:00";
const base = { now: NOW, showUntil: SHOW_UNTIL, hiddenUntil: null, closedThisSession: false };

describe("shouldShowNotice", () => {
  it("shows to a first-time visitor", () => {
    expect(shouldShowNotice(base)).toBe(true);
  });

  it("stays hidden for 7 days after 'hide for a week'", () => {
    const hiddenUntil = String(hideUntilFrom(NOW));
    const sixDaysLater = NOW + 6 * 24 * 60 * 60 * 1000;
    expect(shouldShowNotice({ ...base, now: sixDaysLater, hiddenUntil })).toBe(false);
  });

  it("shows again once the 7 days have passed", () => {
    const hiddenUntil = String(hideUntilFrom(NOW));
    const eightDaysLater = NOW + 8 * 24 * 60 * 60 * 1000;
    expect(shouldShowNotice({ ...base, now: eightDaysLater, hiddenUntil })).toBe(true);
  });

  it("hides for the rest of the session after 'close'", () => {
    expect(shouldShowNotice({ ...base, closedThisSession: true })).toBe(false);
  });

  it("never shows after the notice period ends, judged in KST", () => {
    // 2026-11-05 23:59 KST = 14:59 UTC — 아직 게시 중
    expect(shouldShowNotice({ ...base, now: Date.parse("2026-11-05T14:59:00Z") })).toBe(true);
    // 2026-11-06 00:00 KST = 2026-11-05 15:00 UTC — 종료
    expect(shouldShowNotice({ ...base, now: Date.parse("2026-11-05T15:00:00Z") })).toBe(false);
  });

  it("treats a corrupted stored value as not hidden", () => {
    expect(shouldShowNotice({ ...base, hiddenUntil: "not-a-number" })).toBe(true);
  });
});

describe("storage keys", () => {
  it("are scoped by notice id so a new notice shows again", () => {
    expect(hideKey("a")).not.toBe(hideKey("b"));
    expect(closedKey("a")).not.toBe(hideKey("a"));
  });
});
