// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: 11,
    role: "user",
    nickname: "개발자",
    email: "dev@example.com",
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PATCH } from "./route";

type Update = { table: string; values: Record<string, unknown> };

function stubDb() {
  const updates: Update[] = [];
  const from = (table: string) => {
    const builder: Record<string, unknown> = {
      update(values: Record<string, unknown>) {
        updates.push({ table, values });
        return builder;
      },
      eq: () => builder,
      then: (resolve: (r: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return builder;
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return updates;
}

const patch = (body: Record<string, unknown>) =>
  PATCH(
    new Request("http://localhost/api/apps/3", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "3" }) },
  );

describe("PATCH /api/apps/[id] — 급구는 결제로만 켜진다", () => {
  test("rejects turning boost on from the app owner", async () => {
    const updates = stubDb();
    const res = await patch({ is_boost: true });
    expect(res.status).toBe(403);
    expect(updates).toEqual([]);
  });

  test("rejects turning boost off as well, so paid exposure is not toggled by hand", async () => {
    const updates = stubDb();
    const res = await patch({ is_boost: false });
    expect(res.status).toBe(403);
    expect(updates).toEqual([]);
  });

  test("still saves ordinary app edits", async () => {
    const updates = stubDb();
    const res = await patch({ name: "가계부 2" });
    expect(res.status).toBe(200);
    expect(updates).toEqual([{ table: "apps", values: { name: "가계부 2" } }]);
  });
});
