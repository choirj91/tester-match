import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/slack", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/slack")>()),
  postSlackMessage: vi.fn(),
}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { inquiryAnsweredEmail } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications";
import { postSlackMessage } from "@/lib/slack";
import {
  announceInquiry,
  answerInquiry,
  createInquiry,
  getInquiryForAdmin,
  getOwnInquiry,
} from "./inquiries";

type Result = { data?: unknown; error?: { message: string } | null };
type Call = { op: "select" | "insert" | "update"; filters: Record<string, unknown>; values?: unknown; columns?: string };

/**
 * PostgREST 쿼리 빌더 흉내 — 체인 메서드는 자기 자신을 돌려주고, await 하면 미리 정한 결과를 준다.
 * 어떤 조건으로 호출됐는지 calls 에 남긴다.
 */
function fakeSupabase(respond: (call: Call) => Result) {
  const calls: Call[] = [];
  const from = () => {
    const call: Call = { op: "select", filters: {} };
    calls.push(call);
    const builder: Record<string, unknown> = {
      select(columns: string) {
        call.columns = columns;
        return builder;
      },
      insert(values: unknown) {
        call.op = "insert";
        call.values = values;
        return builder;
      },
      update(values: unknown) {
        call.op = "update";
        call.values = values;
        return builder;
      },
      eq(column: string, value: unknown) {
        call.filters[column] = value;
        return builder;
      },
      gte: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve(respond(call)),
      single: () => Promise.resolve(respond(call)),
      then: (resolve: (r: Result) => unknown) => Promise.resolve(respond(call)).then(resolve),
    };
    return builder;
  };
  return { client: { from } as unknown as SupabaseClient, calls };
}

const input = { category: "paid" as const, title: "결제 문의", body: "결제가 두 번 된 것 같습니다." };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("getOwnInquiry", () => {
  test("본인 id 로 걸러 조회하고 운영용 열은 요청하지 않는다", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: 5, user_id: 7 }, error: null }));
    const result = await getOwnInquiry(client, 5, 7);
    expect(result.kind).toBe("found");
    expect(calls[0].filters).toEqual({ id: 5, user_id: 7 });
    expect(calls[0].columns).not.toContain("admin_memo");
    expect(calls[0].columns).not.toContain("slack_notified_at");
    expect(calls[0].columns).not.toContain("email");
  });

  test("남의 문의와 없는 문의는 똑같이 missing 이다", async () => {
    // DB 가 user_id 조건으로 0행을 돌려주는 상황 — 남의 문의든 없는 id 든 같다
    const { client } = fakeSupabase(() => ({ data: null, error: null }));
    expect(await getOwnInquiry(client, 5, 8)).toEqual({ kind: "missing" });
  });

  test("조회 실패는 missing 이 아니라 error 다", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: { message: "boom" } }));
    expect(await getOwnInquiry(client, 5, 7)).toEqual({ kind: "error" });
  });
});

describe("getInquiryForAdmin", () => {
  test("작성자 조건 없이 조회하고 운영용 열을 포함한다", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: { id: 5 }, error: null }));
    expect((await getInquiryForAdmin(client, 5)).kind).toBe("found");
    expect(calls[0].filters).toEqual({ id: 5 });
    expect(calls[0].columns).toContain("admin_memo");
    expect(calls[0].columns).toContain("users!inquiries_user_id_fkey");
  });
});

describe("createInquiry", () => {
  test("접수하면 id 를 돌려주고 작성자 id 로 저장한다", async () => {
    const { client, calls } = fakeSupabase((call) =>
      call.op === "insert" ? { data: { id: 31 }, error: null } : { data: [], error: null },
    );
    expect(await createInquiry(client, { id: 7 }, input)).toEqual({ ok: true, id: 31 });
    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.values).toEqual({ user_id: 7, ...input });
  });

  test("방금 접수한 문의가 있으면 저장하지 않고 429", async () => {
    const { client, calls } = fakeSupabase(() => ({
      data: [{ created_at: new Date().toISOString() }],
      error: null,
    }));
    const result = await createInquiry(client, { id: 7 }, input);
    expect(result).toMatchObject({ ok: false, status: 429 });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });

  test("DB 트리거가 한도 초과로 거절하면 429 (동시 요청)", async () => {
    const { client } = fakeSupabase((call) =>
      call.op === "insert"
        ? { data: null, error: { message: "INQUIRY_RATE_LIMIT_DAILY" } }
        : { data: [], error: null },
    );
    expect(await createInquiry(client, { id: 7 }, input)).toMatchObject({ ok: false, status: 429 });
  });

  test("사전 조회가 실패하면 저장하지 않고 500", async () => {
    const { client, calls } = fakeSupabase(() => ({ data: null, error: { message: "boom" } }));
    expect(await createInquiry(client, { id: 7 }, input)).toMatchObject({ ok: false, status: 500 });
    expect(calls.some((c) => c.op === "insert")).toBe(false);
  });
});

describe("announceInquiry", () => {
  test("Slack 전송에 성공하면 전송 시각을 기록한다", async () => {
    vi.mocked(postSlackMessage).mockResolvedValue({ ok: true });
    const { client, calls } = fakeSupabase(() => ({ data: null, error: null }));
    expect(await announceInquiry(client, 31, { id: 7, nickname: "테스터" }, input)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("update");
    expect(calls[0].filters).toEqual({ id: 31 });
    expect(calls[0].values).toHaveProperty("slack_notified_at");
  });

  test("Slack 전송에 실패하면 시각을 기록하지 않는다", async () => {
    vi.mocked(postSlackMessage).mockResolvedValue({ ok: false, reason: "no_webhook" });
    const { client, calls } = fakeSupabase(() => ({ data: null, error: null }));
    expect(await announceInquiry(client, 31, { id: 7, nickname: "테스터" }, input)).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("answerInquiry", () => {
  const answered = {
    data: { id: 31, user_id: 7, title: "결제 문의", users: { nickname: "테스터", email: "t@example.com" } },
    error: null,
  };

  test("답변을 저장하고 작성자에게 알림과 메일을 보낸다", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ ok: true, id: "m1" });
    const { client, calls } = fakeSupabase(() => answered);
    expect(await answerInquiry(client, 1, 31, "확인했습니다.")).toEqual({ ok: true, emailSent: true });
    expect(calls[0].values).toMatchObject({ answer: "확인했습니다.", status: "answered", answered_by: 1 });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 7, type: "inquiry_answered", link: "/inquiries/31" }),
    );
    expect(vi.mocked(sendEmail).mock.calls[0][0].to).toBe("t@example.com");
  });

  test("메일 발송이 실패해도 답변은 등록되고, 실패 사실을 돌려준다", async () => {
    vi.mocked(sendEmail).mockResolvedValue({ ok: false, reason: "http_error", detail: "429" });
    const { client } = fakeSupabase(() => answered);
    expect(await answerInquiry(client, 1, 31, "확인했습니다.")).toEqual({ ok: true, emailSent: false });
  });

  test("없는 문의면 404 이고 아무것도 보내지 않는다", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: null }));
    expect(await answerInquiry(client, 1, 999, "x")).toMatchObject({ ok: false, status: 404 });
    expect(createNotification).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("inquiryAnsweredEmail", () => {
  test("닉네임·제목·답변의 HTML 을 이스케이프한다", () => {
    const mail = inquiryAnsweredEmail({
      nickname: "<b>닉</b>",
      inquiryId: 31,
      title: "<script>alert(1)</script>",
      answer: "<img src=x onerror=1>\n둘째 줄",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(mail.html).toContain("/inquiries/31");
    expect(mail.text).toContain("둘째 줄");
  });
});
