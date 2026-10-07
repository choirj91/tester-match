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
vi.mock("@/lib/slack", () => ({
  opsSlackWebhookUrl: vi.fn(() => "https://hooks.slack.com/services/T/B/x"),
  dailyReportSlackPayload: vi.fn((args: unknown) => ({ text: "report", args })),
  postSlackMessage: vi.fn(async () => ({ ok: true })),
}));

import { loadCreditAnomalyAlerts } from "@/lib/credit-anomalies";
import { sendEmail } from "@/lib/email";
import { buildOrderReport } from "@/lib/paid-order-report";
import { dailyReportSlackPayload, postSlackMessage } from "@/lib/slack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

/** count 조회 두 개(올해 결제·자동 취소)만 하는 DB */
function stubDb() {
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
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
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
});
