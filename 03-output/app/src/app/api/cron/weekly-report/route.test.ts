// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: vi.fn(() => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/email", () => ({
  getAdminNotifyEmail: vi.fn(() => "admin@example.com"),
  sendEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/slack", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/slack")>();
  return {
    ...actual,
    opsSlackWebhookUrl: vi.fn(() => "https://hooks.slack.com/services/T/B/x"),
    postSlackMessage: vi.fn(async () => ({ ok: true })),
  };
});

import { verifyCronAuth } from "@/lib/cron-auth";
import { sendEmail } from "@/lib/email";
import { GAIN_REPORT_FAILED_ALERT } from "@/lib/gain-report";
import { postSlackMessage } from "@/lib/slack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET, POST } from "./route";

type RpcResult = { data: unknown; error: { message: string } | null };

function stubRpc(result: RpcResult) {
  const range = vi.fn(async () => result);
  const rpc = vi.fn(() => ({ range }));
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc } as never);
  return { rpc, range };
}

const ROWS = [
  {
    kind: "credit",
    user_id: 7,
    nickname: "테스터<!here>",
    gained: 2200,
    entries: 2,
    detail: "earn 2,200",
  },
  {
    kind: "credit",
    user_id: 12,
    nickname: "개발자",
    gained: 1100,
    entries: 1,
    detail: "refund 1,100",
  },
  {
    kind: "trust",
    user_id: 7,
    nickname: "테스터<!here>",
    gained: 6,
    entries: 6,
    detail: "reward.checkin 6",
  },
];

beforeEach(() => {
  // 금요일 KST 22:03 — 타이머가 3분 늦게 돈 경우
  vi.useFakeTimers({ now: new Date("2026-10-09T13:03:00.000Z"), toFake: ["Date"] });
  vi.mocked(sendEmail).mockClear();
  vi.mocked(postSlackMessage).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("weekly-report — Friday 22:00 KST admin report", () => {
  test("reports last Friday 22:00 → this Friday 22:00 KST by mail and to the ops Slack", async () => {
    const { rpc, range } = stubRpc({ data: ROWS, error: null });

    const res = await GET(new Request("http://localhost/api/cron/weekly-report"));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("member_gain_report", {
      p_since: "2026-10-02T13:00:00.000Z",
      p_until: "2026-10-09T13:00:00.000Z",
    });
    expect(range).toHaveBeenCalledWith(0, 999);

    const mail = vi.mocked(sendEmail).mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      html: string;
    };
    expect(mail.to).toBe("admin@example.com");
    expect(mail.subject).toBe(
      "[Tester Match] 주간 리포트 10/02 22:00 – 10/09 22:00 — 크레딧 증가 2명 · 신뢰도 증가 1명",
    );
    expect(mail.html).toContain("테스터&lt;!here&gt;");
    expect(mail.html).toContain("2명 · 합계 3,300 크레딧");

    const [webhook, payload] = vi.mocked(postSlackMessage).mock.calls[0] ?? [];
    expect(webhook).toBe("https://hooks.slack.com/services/T/B/x");
    const slack = JSON.stringify(payload);
    expect(slack).toContain("주간 리포트 10/02 22:00 – 10/09 22:00");
    expect(slack).toContain("#7 테스터&lt;!here&gt; +2,200 크레딧");
    expect(slack).not.toContain("<!here>");
  });

  test("answers with counts only — no member lists or nicknames in the JSON", async () => {
    stubRpc({ data: ROWS, error: null });

    const res = await POST(
      new Request("http://localhost/api/cron/weekly-report", { method: "POST" }),
    );
    const body = await res.json();

    expect(body).toEqual({
      ok: true,
      since: "2026-10-02T13:00:00.000Z",
      until: "2026-10-09T13:00:00.000Z",
      gainsLoaded: true,
      creditGain: { members: 2, gained: 3300 },
      trustGain: { members: 1, gained: 6 },
      emailSent: true,
      slackSent: true,
    });
  });

  test("a mid-week manual run reports the last closed week", async () => {
    vi.setSystemTime(new Date("2026-10-07T06:00:00.000Z")); // 수요일 KST 15:00
    const { rpc } = stubRpc({ data: [], error: null });

    const res = await GET(new Request("http://localhost/api/cron/weekly-report"));
    const body = (await res.json()) as Record<string, unknown>;

    expect(rpc).toHaveBeenCalledWith("member_gain_report", {
      p_since: "2026-09-25T13:00:00.000Z",
      p_until: "2026-10-02T13:00:00.000Z",
    });
    expect(body).toMatchObject({
      creditGain: { members: 0, gained: 0 },
      trustGain: { members: 0, gained: 0 },
    });
    const mail = vi.mocked(sendEmail).mock.calls[0]?.[0] as { subject: string; html: string };
    expect(mail.subject).toContain("주간 리포트 09/25 22:00 – 10/02 22:00");
    expect(mail.html).toContain("증가한 회원이 없습니다");
  });

  test("a failed query sends an alert instead of an empty report and says so in the JSON", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubRpc({ data: null, error: { message: "permission denied" } });

    const res = await GET(new Request("http://localhost/api/cron/weekly-report"));
    const body = await res.json();

    expect(body).toMatchObject({ ok: true, gainsLoaded: false, emailSent: true, slackSent: true });
    expect(body).not.toHaveProperty("creditGain");
    const mail = vi.mocked(sendEmail).mock.calls[0]?.[0] as { subject: string; html: string };
    expect(mail.subject.startsWith("[ACTION]")).toBe(true);
    expect(mail.html).toContain(GAIN_REPORT_FAILED_ALERT);
    expect(mail.html).not.toContain("증가한 회원이 없습니다");
    const slack = JSON.stringify(vi.mocked(postSlackMessage).mock.calls[0]?.[1]);
    expect(slack).toContain(GAIN_REPORT_FAILED_ALERT);
    expect(slack).toContain("확인 필요 1건");
  });

  test("rejects calls without the cron secret", async () => {
    vi.mocked(verifyCronAuth).mockReturnValueOnce(false);
    const res = await GET(new Request("http://localhost/api/cron/weekly-report"));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
