// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: vi.fn(() => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/paid-order-report", () => ({ buildOrderReport: vi.fn() }));
vi.mock("@/lib/paid-order-sweep", () => ({ runSweepStep: vi.fn() }));
vi.mock("@/lib/credit-anomalies", () => ({ loadCreditAnomalyAlerts: vi.fn() }));
vi.mock("@/lib/email", () => ({
  getAdminNotifyEmail: vi.fn(() => "admin@example.com"),
  sendEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/slack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slack")>();
  return {
    ...actual,
    opsSlackWebhookUrl: vi.fn(() => "https://hooks.slack.com/services/T/B/x"),
    dailyReportSlackPayload: vi.fn(actual.dailyReportSlackPayload),
    postSlackMessage: vi.fn(async () => ({ ok: true })),
  };
});

import { loadCreditAnomalyAlerts } from "@/lib/credit-anomalies";
import { sendEmail } from "@/lib/email";
import { GAIN_REPORT_FAILED_ALERT } from "@/lib/gain-report";
import { buildOrderReport } from "@/lib/paid-order-report";
import { dailyReportSlackPayload, postSlackMessage } from "@/lib/slack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

type RpcResult = { data: unknown; error: { message: string } | null };

/** count 조회 두 개(올해 결제·자동 취소) + 회원 증가 내역 rpc(member_gain_report) 만 하는 DB */
function stubDb(gainResult: RpcResult = { data: [], error: null }) {
  const from = () => {
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      like: () => builder,
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve({ count: 1, error: null }).then(resolve),
    };
    return builder;
  };
  const range = vi.fn(async () => gainResult);
  const rpc = vi.fn(() => ({ range }));
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from, rpc } as never);
  return { rpc };
}

describe("paid-orders-report — daily report also goes to Slack", () => {
  test("puts credit anomaly alerts into the mail and the Slack message", async () => {
    stubDb();
    vi.mocked(buildOrderReport).mockResolvedValue({
      rows: [],
      alerts: ["주문 확인 필요"],
    } as never);
    vi.mocked(loadCreditAnomalyAlerts).mockResolvedValue([
      "크레딧 이상 · 잔액 0 미만: 1명 (#3 -100)",
    ]);

    const res = await GET(new Request("http://localhost/api/cron/paid-orders-report"));
    const body = (await res.json()) as { alerts: string[]; emailSent: boolean; slackSent: boolean };

    expect(body.alerts).toEqual(["주문 확인 필요", "크레딧 이상 · 잔액 0 미만: 1명 (#3 -100)"]);
    expect(body.emailSent).toBe(true);
    expect(body.slackSent).toBe(true);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(vi.mocked(dailyReportSlackPayload).mock.calls[0]?.[0]).toMatchObject({
      alerts: body.alerts,
      activeOrders: 0,
    });
    expect(postSlackMessage).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T/B/x",
      expect.anything(),
    );
  });

  test("preview mode shows the same alerts without sending anything", async () => {
    stubDb();
    vi.mocked(sendEmail).mockClear();
    vi.mocked(postSlackMessage).mockClear();
    vi.mocked(buildOrderReport).mockResolvedValue({ rows: [], alerts: [] } as never);
    vi.mocked(loadCreditAnomalyAlerts).mockResolvedValue([
      "크레딧 이상 징후 조회 실패 — 직접 확인이 필요합니다.",
    ]);

    const res = await GET(new Request("http://localhost/api/cron/paid-orders-report?mode=preview"));
    const body = (await res.json()) as { alerts: string[] };

    expect(body.alerts).toHaveLength(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(postSlackMessage).not.toHaveBeenCalled();
  });

  test("lists members whose credits and trust score rose in the last 24 hours, in mail and Slack", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-08T23:30:00.000Z"), toFake: ["Date"] });
    try {
      const { rpc } = stubDb({
        data: [
          {
            kind: "credit",
            user_id: 12,
            nickname: "<b>닉</b>",
            gained: 1700,
            entries: 2,
            detail: "refund 1,100 · earn 600",
          },
          {
            kind: "trust",
            user_id: 12,
            nickname: "<b>닉</b>",
            gained: 3,
            entries: 3,
            detail: "reward.checkin 3",
          },
        ],
        error: null,
      });
      vi.mocked(sendEmail).mockClear();
      vi.mocked(postSlackMessage).mockClear();
      vi.mocked(buildOrderReport).mockResolvedValue({ rows: [], alerts: [] } as never);
      vi.mocked(loadCreditAnomalyAlerts).mockResolvedValue([]);

      const res = await GET(new Request("http://localhost/api/cron/paid-orders-report"));
      const body = (await res.json()) as Record<string, unknown>;

      expect(rpc).toHaveBeenCalledWith("member_gain_report", {
        p_since: "2026-10-07T23:30:00.000Z",
        p_until: "2026-10-08T23:30:00.000Z",
      });
      const mail = vi.mocked(sendEmail).mock.calls[0]?.[0] as {
        subject: string;
        html: string;
        text: string;
      };
      expect(mail.subject).not.toContain("[ACTION]");
      expect(mail.html).toContain("크레딧 증가 — 최근 24시간");
      expect(mail.html).toContain("&lt;b&gt;닉&lt;/b&gt;");
      expect(mail.html).not.toContain("<b>닉</b>");
      expect(mail.html).toContain("+1,700 크레딧");
      expect(mail.text).toContain("- #12 <b>닉</b> 신뢰도 +3 (3건: reward.checkin 3)");
      const slack = JSON.stringify(vi.mocked(postSlackMessage).mock.calls[0]?.[1]);
      expect(slack).toContain(
        "#12 &lt;b&gt;닉&lt;/b&gt; +1,700 크레딧 (2건: refund 1,100 · earn 600)",
      );
      expect(slack).toContain("신뢰도 +3");
      // 응답은 숫자만 — 닉네임·목록은 Functions 가 Slack 으로 옮기지 않게 싣지 않는다
      expect(body).toMatchObject({
        alerts: [],
        gainsLoaded: true,
        creditGain: { members: 1, gained: 1700 },
        trustGain: { members: 1, gained: 3 },
      });
      expect(JSON.stringify(body)).not.toContain("닉");
    } finally {
      vi.useRealTimers();
    }
  });

  test("a failed gain query becomes an alert line, never an empty list", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    stubDb({ data: null, error: { message: "function does not exist" } });
    vi.mocked(sendEmail).mockClear();
    vi.mocked(postSlackMessage).mockClear();
    vi.mocked(buildOrderReport).mockResolvedValue({ rows: [], alerts: [] } as never);
    vi.mocked(loadCreditAnomalyAlerts).mockResolvedValue([]);

    const res = await GET(new Request("http://localhost/api/cron/paid-orders-report"));
    const body = (await res.json()) as { alerts: string[]; gainsLoaded: boolean };

    expect(body.alerts).toEqual([GAIN_REPORT_FAILED_ALERT]);
    expect(body.gainsLoaded).toBe(false);
    const mail = vi.mocked(sendEmail).mock.calls[0]?.[0] as { subject: string; html: string };
    expect(mail.subject).toContain("[ACTION]");
    expect(mail.html).toContain(GAIN_REPORT_FAILED_ALERT);
    expect(mail.html).not.toContain("증가한 회원이 없습니다");
    const slack = JSON.stringify(vi.mocked(postSlackMessage).mock.calls[0]?.[1]);
    expect(slack).toContain(GAIN_REPORT_FAILED_ALERT);
    expect(slack).not.toContain("크레딧 증가");
    errorLog.mockRestore();
  });
});
