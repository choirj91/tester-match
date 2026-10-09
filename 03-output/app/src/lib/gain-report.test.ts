import { afterEach, describe, expect, test, vi } from "vitest";
import {
  GAIN_REPORT_FAILED_ALERT,
  type GainRow,
  dailyGainWindow,
  formatGain,
  formatGainLine,
  formatGainSummary,
  formatWindowLabel,
  gainCounts,
  loadGainReport,
  weeklyReportWindow,
} from "./gain-report";

const iso = (d: Date) => d.toISOString();

function row(
  kind: GainRow["kind"],
  userId: number,
  gained: number,
  extra: Partial<GainRow> = {},
): GainRow {
  return {
    kind,
    user_id: userId,
    nickname: `회원${userId}`,
    gained,
    entries: 1,
    detail: "",
    ...extra,
  };
}

/** rpc(...).range(from, to) 를 흉내 — pages[i] 가 i 번째 호출의 응답 */
function stubRpc(pages: Array<{ data: unknown; error: { message: string } | null }>) {
  const range = vi.fn(async () => pages.shift() ?? { data: [], error: null });
  const rpc = vi.fn(() => ({ range }));
  return { client: { rpc } as never, rpc, range };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("weeklyReportWindow — Fri 22:00 KST (= Fri 13:00 UTC) to Fri 22:00 KST", () => {
  const LAST_FRI = "2026-10-02T13:00:00.000Z";
  const THIS_FRI = "2026-10-09T13:00:00.000Z";

  test("a run exactly at Fri 13:00 UTC covers the week that just ended", () => {
    const w = weeklyReportWindow(new Date(THIS_FRI));
    expect(iso(w.since)).toBe(LAST_FRI);
    expect(iso(w.until)).toBe(THIS_FRI);
  });

  test("a run a few minutes (or up to 30 minutes) late still ends at 22:00, not at the run time", () => {
    for (const at of [
      "2026-10-09T13:04:31.000Z",
      "2026-10-09T13:29:59.999Z",
      "2026-10-09T13:30:00.000Z",
    ]) {
      const w = weeklyReportWindow(new Date(at));
      expect(iso(w.until)).toBe(THIS_FRI);
      expect(iso(w.since)).toBe(LAST_FRI);
    }
  });

  test("a timer that wakes just before 22:00 (clock skew under 2 minutes) counts as that Friday", () => {
    expect(iso(weeklyReportWindow(new Date("2026-10-09T12:59:59.000Z")).until)).toBe(THIS_FRI);
    expect(iso(weeklyReportWindow(new Date("2026-10-09T12:58:01.000Z")).until)).toBe(THIS_FRI);
  });

  test("a run well before 22:00 on Friday reports the previous closed week", () => {
    const w = weeklyReportWindow(new Date("2026-10-09T12:50:00.000Z"));
    expect(iso(w.until)).toBe(LAST_FRI);
    expect(iso(w.since)).toBe("2026-09-25T13:00:00.000Z");
  });

  test("a mid-week manual run reports the last closed week", () => {
    // Wed 2026-10-07 15:00 KST
    const w = weeklyReportWindow(new Date("2026-10-07T06:00:00.000Z"));
    expect(iso(w.until)).toBe(LAST_FRI);
    expect(iso(w.since)).toBe("2026-09-25T13:00:00.000Z");
  });

  test("uses the KST calendar: Fri 05:00 KST is still Thursday in UTC and belongs to the previous week", () => {
    const w = weeklyReportWindow(new Date("2026-10-08T20:00:00.000Z"));
    expect(iso(w.until)).toBe(LAST_FRI);
  });

  test("Saturday 00:30 KST (Friday 15:30 UTC) belongs to the week that ended Friday 22:00", () => {
    expect(iso(weeklyReportWindow(new Date("2026-10-09T15:30:00.000Z")).until)).toBe(THIS_FRI);
  });

  test("crosses month and year boundaries (2027-01-01 is a Friday)", () => {
    const w = weeklyReportWindow(new Date("2027-01-01T13:00:00.000Z"));
    expect(iso(w.since)).toBe("2026-12-25T13:00:00.000Z");
    expect(iso(w.until)).toBe("2027-01-01T13:00:00.000Z");
  });

  test("always spans exactly 7 × 24 hours (KST has no daylight saving time)", () => {
    for (let h = 0; h < 24 * 14; h += 5) {
      const w = weeklyReportWindow(new Date(Date.UTC(2026, 9, 1, h, 17)));
      expect(w.until.getTime() - w.since.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
      expect(w.until.getUTCDay()).toBe(5);
      expect(w.until.getUTCHours()).toBe(13);
    }
  });

  test("does not depend on the server's local time zone", () => {
    const original = process.env.TZ;
    const at = new Date("2026-10-09T13:05:00.000Z");
    try {
      const results = ["UTC", "Asia/Seoul", "America/Los_Angeles", "Pacific/Chatham"].map((tz) => {
        process.env.TZ = tz;
        const w = weeklyReportWindow(at);
        return `${iso(w.since)} ${iso(w.until)} ${formatWindowLabel(w)}`;
      });
      expect(new Set(results).size).toBe(1);
    } finally {
      process.env.TZ = original;
    }
  });
});

describe("dailyGainWindow / formatWindowLabel", () => {
  test("daily window is the 24 hours before the run", () => {
    const now = new Date("2026-10-08T23:30:00.000Z");
    const w = dailyGainWindow(now);
    expect(iso(w.since)).toBe("2026-10-07T23:30:00.000Z");
    expect(w.until).toBe(now);
  });

  test("labels the window in KST", () => {
    const w = weeklyReportWindow(new Date("2026-10-09T13:00:00.000Z"));
    expect(formatWindowLabel(w)).toBe("10/02 22:00 – 10/09 22:00");
  });
});

describe("formatting", () => {
  test("credits use the 크레딧 unit, never 원 or ₩", () => {
    expect(formatGain("credit", 1100)).toBe("+1,100 크레딧");
    expect(formatGain("trust", 14)).toBe("신뢰도 +14");
    const text = formatGainSummary("credit", { members: 3, gained: 2800, rows: [] });
    expect(text).toBe("3명 · 합계 2,800 크레딧");
    expect(text).not.toMatch(/[원₩]/);
    expect(formatGainSummary("trust", { members: 12, gained: 45, rows: [] })).toBe(
      "12명 · 합계 신뢰도 +45",
    );
  });

  test("one line per member: id, nickname, amount, entries and breakdown — escaped by the caller's rule", () => {
    const r = row("credit", 12, 1700, {
      nickname: "<!channel>",
      entries: 2,
      detail: "refund 1,100 · earn 600",
    });
    expect(formatGainLine(r)).toBe("#12 <!channel> +1,700 크레딧 (2건: refund 1,100 · earn 600)");
    expect(formatGainLine(r, (v) => v.replace(/</g, "&lt;"))).toBe(
      "#12 &lt;!channel> +1,700 크레딧 (2건: refund 1,100 · earn 600)",
    );
    expect(formatGainLine(row("trust", 3, 1, { nickname: null }))).toBe("#3 - 신뢰도 +1 (1건)");
  });
});

describe("loadGainReport", () => {
  const window = {
    since: new Date("2026-10-08T00:00:00.000Z"),
    until: new Date("2026-10-09T00:00:00.000Z"),
  };

  test("asks the DB for the window, splits by kind, sorts by amount and totals each list", async () => {
    const { client, rpc, range } = stubRpc([
      {
        data: [
          row("credit", 5, 600),
          { ...row("credit", 7, 0), gained: "2100" },
          row("trust", 5, 3, { entries: 3, detail: "reward.checkin 3" }),
        ],
        error: null,
      },
    ]);
    const report = await loadGainReport(client, window);

    expect(rpc).toHaveBeenCalledWith("member_gain_report", {
      p_since: "2026-10-08T00:00:00.000Z",
      p_until: "2026-10-09T00:00:00.000Z",
    });
    expect(range).toHaveBeenCalledWith(0, 999);
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.credit.rows.map((r) => r.user_id)).toEqual([7, 5]);
    expect(report.credit).toMatchObject({ members: 2, gained: 2700 });
    expect(report.trust).toMatchObject({ members: 1, gained: 3 });
  });

  test("reads past the 1,000-row PostgREST cap page by page", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => row("trust", i + 1, 1));
    const { client, range } = stubRpc([
      { data: full, error: null },
      { data: [row("trust", 1001, 1), row("credit", 1, 600)], error: null },
    ]);
    const report = await loadGainReport(client, window);

    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(report.ok && report.trust.members).toBe(1001);
    expect(report.ok && report.credit.members).toBe(1);
  });

  test("a failed query becomes an alert line, never an empty (all clear) report", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = stubRpc([{ data: null, error: { message: "function does not exist" } }]);
    const report = await loadGainReport(client, window);
    expect(report).toEqual({ ok: false, alert: GAIN_REPORT_FAILED_ALERT });
    expect(gainCounts(report)).toEqual({ gainsLoaded: false });
  });

  test("gainCounts gives numbers only — no nicknames or lists", async () => {
    const { client } = stubRpc([
      { data: [row("credit", 5, 600, { nickname: "비밀닉" })], error: null },
    ]);
    const counts = gainCounts(await loadGainReport(client, window));
    expect(counts).toEqual({
      gainsLoaded: true,
      creditGain: { members: 1, gained: 600 },
      trustGain: { members: 0, gained: 0 },
    });
    expect(JSON.stringify(counts)).not.toContain("비밀닉");
  });
});
