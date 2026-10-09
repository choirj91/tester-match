import { afterEach, describe, expect, test, vi } from "vitest";
import {
  dailyReportSlackPayload,
  escapeSlackText,
  inquirySlackPayload,
  isSlackWebhookUrl,
  opsSlackWebhookUrl,
  postSlackMessage,
  weeklyReportSlackPayload,
} from "./slack";
import type { GainList, GainReport, GainRow } from "./gain-report";

const WEBHOOK = "https://hooks.slack.com/services/T000/B000/XXXX";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("escapeSlackText", () => {
  test("멘션·링크로 해석되는 문자를 이스케이프한다", () => {
    expect(escapeSlackText("<!channel> a & b <https://evil.example|클릭>")).toBe(
      "&lt;!channel&gt; a &amp; b &lt;https://evil.example|클릭&gt;",
    );
  });
});

describe("isSlackWebhookUrl", () => {
  test("hooks.slack.com 의 https 웹훅만 허용한다", () => {
    expect(isSlackWebhookUrl(WEBHOOK)).toBe(true);
    expect(isSlackWebhookUrl("http://hooks.slack.com/services/T/B/X")).toBe(false);
    expect(isSlackWebhookUrl("https://hooks.slack.com.evil.example/services/T/B/X")).toBe(false);
    expect(isSlackWebhookUrl("https://example.com/services/T/B/X")).toBe(false);
    expect(isSlackWebhookUrl("https://hooks.slack.com/other")).toBe(false);
    expect(isSlackWebhookUrl("not a url")).toBe(false);
  });
});

describe("postSlackMessage", () => {
  test("웹훅이 없으면 보내지 않고, 설정이 빠졌다는 경고를 남긴다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await postSlackMessage(undefined, { text: "x" })).toEqual({ ok: false, reason: "no_webhook" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
  });

  test("응답이 없으면 5초 뒤 요청을 끊고 실패로 돌려준다", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
          }),
      ),
    );
    const pending = postSlackMessage(WEBHOOK, { text: "x" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ ok: false, reason: "exception" });
    vi.useRealTimers();
  });

  test("Slack 주소가 아니면 보내지 않는다", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await postSlackMessage("https://example.com/hook", { text: "x" });
    expect(result).toEqual({ ok: false, reason: "invalid_webhook" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("정상 전송 시 JSON 본문으로 POST 한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await postSlackMessage(WEBHOOK, { text: "hello" });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ text: "hello" });
  });

  test("HTTP 오류는 실패로 돌려주고 웹훅 주소를 로그에 남기지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no_service", { status: 404 })));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await postSlackMessage(WEBHOOK, { text: "x" });
    expect(result).toEqual({ ok: false, reason: "http_error", detail: "404" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("hooks.slack.com");
  });

  test("네트워크 예외도 실패로 돌려주고 웹훅 주소를 로그에 남기지 않는다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`request to ${WEBHOOK} failed`)));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await postSlackMessage(WEBHOOK, { text: "x" });
    expect(result).toEqual({ ok: false, reason: "exception" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("hooks.slack.com");
  });
});

describe("inquirySlackPayload", () => {
  const base = {
    id: 12,
    categoryLabel: "유료 테스터·결제",
    title: "결제가 <두 번> 됐어요",
    body: "안녕하세요.\n\n결제가 두 번 된 것 같습니다 <!channel>",
    nickname: "테스터<1>",
    userId: 77,
  };

  test("제목·본문·닉네임을 이스케이프하고 관리자 링크를 넣는다", () => {
    const payload = inquirySlackPayload(base);
    const json = JSON.stringify(payload);
    expect(payload.text).toBe("새 문의 #12 [유료 테스터·결제] 결제가 &lt;두 번&gt; 됐어요");
    expect(json).not.toContain("<!channel>");
    expect(json).toContain("테스터&lt;1&gt; (회원 #77)");
    expect(json).toContain("/admin/inquiries/12|관리자 페이지에서 처리>");
  });

  test("본문은 줄바꿈을 접고 300자에서 자른다", () => {
    const payload = inquirySlackPayload({ ...base, body: `첫 줄\n${"가".repeat(400)}` });
    const section = (payload.blocks?.[1] as { text: { text: string } }).text.text;
    expect(section.startsWith("첫 줄 가")).toBe(true);
    expect(section.length).toBe(301);
    expect(section.endsWith("…")).toBe(true);
  });
});

describe("opsSlackWebhookUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("prefers the ops webhook and falls back to the inquiry webhook", () => {
    vi.stubEnv("SLACK_OPS_WEBHOOK_URL", "");
    vi.stubEnv("SLACK_INQUIRY_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/inquiry");
    expect(opsSlackWebhookUrl()).toBe("https://hooks.slack.com/services/T/B/inquiry");
    vi.stubEnv("SLACK_OPS_WEBHOOK_URL", "https://hooks.slack.com/services/T/B/ops");
    expect(opsSlackWebhookUrl()).toBe("https://hooks.slack.com/services/T/B/ops");
  });
});

describe("dailyReportSlackPayload", () => {
  const base = { dateLabel: "2026-10-07", activeOrders: 2, autoCanceledCount: 1, yearlyPaidCount: 3 };

  test("says there is nothing to act on when there are no alerts", () => {
    const payload = dailyReportSlackPayload({ ...base, alerts: [] });
    expect(payload.text).toContain("2026-10-07");
    expect(payload.text).toContain("이상 없음");
    expect(JSON.stringify(payload)).toContain("진행 중 주문 2건");
  });

  test("lists alerts escaped and counts them in the headline", () => {
    const payload = dailyReportSlackPayload({
      ...base,
      alerts: ["주문 <앱> 확인 필요 <!channel>", "크레딧 이상 · 잔액 0 미만: 1명 (#3 -100)"],
    });
    const json = JSON.stringify(payload);
    expect(payload.text).toContain("확인 필요 2건");
    expect(json).not.toContain("<!channel>");
    expect(json).toContain("&lt;앱&gt;");
    expect(json).toContain("크레딧 이상");
    expect(json).toContain("/admin/paid-orders");
  });

  test("keeps every section under Slack's 3,000-character limit even with long alerts", () => {
    const alerts = Array.from({ length: 25 }, (_, i) => `주문 ${i}: ${"<메모>".repeat(200)}`);
    const payload = dailyReportSlackPayload({ ...base, alerts });
    const sections = (payload.blocks ?? []) as Array<{ type: string; text?: { text: string } }>;
    for (const block of sections) {
      if (block.text) expect(block.text.text.length).toBeLessThanOrEqual(3000);
    }
    expect(JSON.stringify(payload)).toContain("외 5건");
  });
});

function gainList(
  kind: GainRow["kind"],
  count: number,
  nickname = (i: number) => `회원${i}`,
): GainList {
  const rows = Array.from({ length: count }, (_, i) => ({
    kind,
    user_id: i + 1,
    nickname: nickname(i + 1),
    gained: (count - i) * 100,
    entries: 2,
    detail: kind === "credit" ? "earn 600 · refund 1,100" : "reward.checkin 1 · reward.referral 10",
  }));
  return { members: count, gained: rows.reduce((s, r) => s + r.gained, 0), rows };
}

const okGains = (credit: GainList, trust: GainList): GainReport => ({ ok: true, credit, trust });

function sectionTexts(payload: { blocks?: unknown[] }): string[] {
  return ((payload.blocks ?? []) as Array<{ text?: { text: string } }>)
    .map((b) => b.text?.text)
    .filter((t): t is string => typeof t === "string");
}

describe("member gain lists in the daily and weekly Slack reports", () => {
  const base = {
    dateLabel: "2026-10-09",
    activeOrders: 0,
    autoCanceledCount: 0,
    yearlyPaidCount: 0,
    alerts: [],
  };

  test("daily report adds both lists with totals, escaped nicknames and 크레딧 units", () => {
    const payload = dailyReportSlackPayload({
      ...base,
      gains: okGains(
        gainList("credit", 2, () => "<!channel>"),
        gainList("trust", 1),
      ),
    });
    const json = JSON.stringify(payload);
    expect(payload.text).toContain("이상 없음");
    expect(json).toContain("*크레딧 증가* (최근 24시간) 2명 · 합계 300 크레딧");
    expect(json).toContain("#1 &lt;!channel&gt; +200 크레딧 (2건: earn 600 · refund 1,100)");
    expect(json).toContain("*신뢰도 증가* (최근 24시간) 1명 · 합계 신뢰도 +100");
    expect(json).not.toContain("<!channel>");
    expect(json).not.toMatch(/[0-9] ?원|₩/);
    expect(json).toContain("/admin/paid-orders");
  });

  test("says 없음 for an empty list and leaves the lists out when the query failed", () => {
    const empty = dailyReportSlackPayload({
      ...base,
      gains: okGains(gainList("credit", 0), gainList("trust", 0)),
    });
    expect(JSON.stringify(empty)).toContain("*크레딧 증가* (최근 24시간) 없음");
    const failed = dailyReportSlackPayload({ ...base, gains: { ok: false, alert: "조회 실패" } });
    expect(JSON.stringify(failed)).not.toContain("크레딧 증가");
    const without = dailyReportSlackPayload(base);
    expect(JSON.stringify(without)).not.toContain("크레딧 증가");
  });

  test("with 200 members per list: top 15 each, 외 185명, every section under 3,000 characters", () => {
    const longNick = (i: number) => `<${"긴닉네임&".repeat(30)}${i}>`;
    const gains = okGains(gainList("credit", 200, longNick), gainList("trust", 200, longNick));
    for (const payload of [
      dailyReportSlackPayload({
        ...base,
        alerts: Array.from({ length: 25 }, (_, i) => `경보 ${i}`),
        gains,
      }),
      weeklyReportSlackPayload({ windowLabel: "10/02 22:00 – 10/09 22:00", gains }),
    ]) {
      const texts = sectionTexts(payload);
      for (const t of texts) expect(t.length).toBeLessThanOrEqual(3000);
      const json = JSON.stringify(payload);
      expect(json.match(/외 185명/g)).toHaveLength(2);
      const memberLines = texts.flatMap((t) => t.split("\n")).filter((l) => /^• #\d+ /.test(l));
      expect(memberLines).toHaveLength(30);
      expect((payload.blocks ?? []).length).toBeLessThanOrEqual(50);
    }
  });

  test("weekly report headline names the window and the member counts", () => {
    const payload = weeklyReportSlackPayload({
      windowLabel: "10/02 22:00 – 10/09 22:00",
      gains: okGains(gainList("credit", 3), gainList("trust", 12)),
    });
    expect(payload.text).toBe(
      "주간 리포트 10/02 22:00 – 10/09 22:00 — 크레딧 증가 3명 · 신뢰도 증가 12명",
    );
    expect(JSON.stringify(payload)).toContain("*크레딧 증가* (지난 7일) 3명 · 합계 600 크레딧");
  });

  test("weekly report turns a failed query into an alert line", () => {
    const payload = weeklyReportSlackPayload({
      windowLabel: "10/02 22:00 – 10/09 22:00",
      gains: { ok: false, alert: "회원 증가 내역 조회 실패 <!here>" },
    });
    const json = JSON.stringify(payload);
    expect(payload.text).toContain("확인 필요 1건");
    expect(json).toContain("회원 증가 내역 조회 실패 &lt;!here&gt;");
    expect(json).not.toContain("없음");
  });
});
