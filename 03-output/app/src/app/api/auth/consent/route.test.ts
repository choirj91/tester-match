// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { getCurrentUser, type AppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

const ORIGIN = "http://localhost:3000";

const USER: AppUser = {
  id: 7,
  authUserId: "auth-7",
  email: "member@example.com",
  nickname: "회원",
  trustScore: 50,
  role: "user",
  balance: 0,
  pendingPolicies: ["terms"],
};

function submit(fields: Record<string, string>, origin = ORIGIN) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return POST(
    new Request(`${ORIGIN}/api/auth/consent`, { method: "POST", headers: { origin }, body: form }),
  );
}

function location(res: Response) {
  const url = new URL(res.headers.get("location") ?? "");
  return url.pathname + url.search;
}

let rpc = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T09:00:00+09:00"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  rpc = vi.fn(async () => ({ data: "recorded", error: null }));
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ rpc } as never);
  vi.mocked(getCurrentUser).mockResolvedValue(USER);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/auth/consent", () => {
  test("시행 중인 버전을 서버가 정해 기록하고 원래 화면으로 돌아간다", async () => {
    const res = await submit({ agreed: "on", next: "/apps/3" });
    expect(res.status).toBe(303);
    expect(location(res)).toBe("/apps/3");
    expect(rpc).toHaveBeenCalledWith("record_policy_consents", {
      p_auth_user_id: "auth-7",
      p_terms_version: "2026-11-28",
      p_privacy_version: null,
      p_source: "consent_screen",
    });
  });

  test("다른 출처에서 온 제출은 기록하지 않는다", async () => {
    const res = await submit({ agreed: "on", next: "/apps/3" }, "https://evil.example");
    expect(location(res)).toBe("/auth/consent");
    expect(rpc).not.toHaveBeenCalled();
  });

  test("동의 칸을 체크하지 않으면 동의 화면으로 되돌린다", async () => {
    const res = await submit({ next: "/apps/3" });
    expect(location(res)).toBe("/auth/consent?next=%2Fapps%2F3&error=agree");
    expect(rpc).not.toHaveBeenCalled();
  });

  test("로그인하지 않았으면 로그인 화면", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await submit({ agreed: "on" });
    expect(location(res)).toBe("/auth/login");
    expect(rpc).not.toHaveBeenCalled();
  });

  test("이미 동의했으면 기록하지 않고 돌아간다", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ ...USER, pendingPolicies: [] });
    const res = await submit({ agreed: "on", next: "/apps/3" });
    expect(location(res)).toBe("/apps/3");
    expect(rpc).not.toHaveBeenCalled();
  });

  test("저장에 실패하면 오류와 함께 동의 화면", async () => {
    rpc.mockResolvedValue({ data: "not_effective", error: null });
    const res = await submit({ agreed: "on", next: "/apps/3" });
    expect(location(res)).toBe("/auth/consent?next=%2Fapps%2F3&error=save");
  });

  test("돌아갈 경로가 사이트 밖이면 홈", async () => {
    const res = await submit({ agreed: "on", next: "//evil.example/x" });
    expect(location(res)).toBe("/");
  });
});
