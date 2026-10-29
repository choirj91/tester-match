// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/credits", () => ({ getBalance: vi.fn(async () => 0) }));
vi.mock("@/lib/google-groups", () => ({
  isGroupsAutoJoinEnabled: () => false,
  addUserToTesterGroup: vi.fn(),
}));

import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";

const LEGACY = [
  { kind: "terms", version: "2026-10-13" },
  { kind: "privacy", version: "2026-10-13" },
];

function adminStub(consents: { data: unknown; error: unknown }) {
  const row = {
    id: 7,
    auth_user_id: "auth-7",
    email: "member@example.com",
    nickname: "회원",
    kakao_nickname: null,
    trust_score: 50,
    role: "user",
    groups_joined_at: "2026-10-01T00:00:00Z",
    last_seen_at: new Date().toISOString(),
  };
  return {
    from: (table: string) => {
      if (table === "users") {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) };
      }
      if (table === "policy_consents") return { select: () => ({ eq: async () => consents }) };
      throw new Error(`unexpected table ${table}`);
    },
  };
}

function atPath(path: string) {
  vi.mocked(headers).mockResolvedValue(new Headers({ "x-tm-pathname": path }) as never);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-28T09:00:00+09:00"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "auth-7", app_metadata: {} } } }) },
  } as never);
  vi.mocked(createSupabaseAdminClient).mockReturnValue(adminStub({ data: LEGACY, error: null }) as never);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("getCurrentUser — 약관 동의 확인", () => {
  test("시행 중인 약관에 동의하지 않았으면 일반 화면에서 동의 화면으로 보낸다", async () => {
    atPath("/apps/3?tab=log");
    await expect(getCurrentUser()).rejects.toThrow("REDIRECT /auth/consent?next=%2Fapps%2F3%3Ftab%3Dlog");
  });

  test("API·정책·동의 화면에서는 보내지 않고 미동의 목록만 돌려준다", async () => {
    for (const path of ["/api/checkin", "/policies/terms", "/auth/consent"]) {
      atPath(path);
      await expect(getCurrentUser()).resolves.toMatchObject({ id: 7, pendingPolicies: ["terms"] });
    }
  });

  test("개정 약관에 동의했으면 그대로 진행한다", async () => {
    atPath("/apps/3");
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      adminStub({ data: [...LEGACY, { kind: "terms", version: "2026-11-28" }], error: null }) as never,
    );
    await expect(getCurrentUser()).resolves.toMatchObject({ pendingPolicies: [] });
  });

  test("동의 기록을 읽지 못하면 막지 않는다 (조회 장애로 사이트 전체가 막히지 않게)", async () => {
    atPath("/apps/3");
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      adminStub({ data: null, error: { code: "42P01" } }) as never,
    );
    await expect(getCurrentUser()).resolves.toMatchObject({ pendingPolicies: [] });
  });

  test("요청 밖에서 불리면(경로 없음) 보내지 않는다", async () => {
    vi.mocked(headers).mockRejectedValue(new Error("outside request scope"));
    await expect(getCurrentUser()).resolves.toMatchObject({ pendingPolicies: ["terms"] });
  });
});
