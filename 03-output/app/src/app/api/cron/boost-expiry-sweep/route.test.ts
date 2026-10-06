// @vitest-environment node
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/cron-auth", () => ({ verifyCronAuth: vi.fn(() => true) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/paid-seats", () => ({ countOpenSeatsByApp: vi.fn() }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn(async () => undefined) }));

import { countOpenSeatsByApp } from "@/lib/paid-seats";
import { createNotification } from "@/lib/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

type AppRow = { id: number; owner_user_id: number; name: string; boost_deadline_at?: string };

/** 만료된 급구 앱 목록과 24시간 안에 만료될 급구 앱 목록을 돌려주는 DB */
function stubDb(expired: AppRow[], expiring: AppRow[]) {
  const updatedIds: number[] = [];
  const from = () => {
    let isExpiringQuery = false;
    let updating = false;
    const builder: Record<string, unknown> = {
      select: () => builder,
      update() {
        updating = true;
        return builder;
      },
      eq(column: string, value: unknown) {
        if (updating && column === "id") updatedIds.push(value as number);
        return builder;
      },
      gt() {
        isExpiringQuery = true;
        return builder;
      },
      lte: () => builder,
      then: (resolve: (r: unknown) => unknown) =>
        Promise.resolve(
          updating ? { error: null } : { data: isExpiringQuery ? expiring : expired, error: null },
        ).then(resolve),
    };
    return builder;
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);
  return updatedIds;
}

const run = () => GET(new Request("http://localhost/api/cron/boost-expiry-sweep"));

describe("boost-expiry-sweep — 급구는 결제로만 다시 켜진다", () => {
  test("expired boost without open seats is cleared and points the owner to the paid order page", async () => {
    vi.mocked(createNotification).mockClear();
    vi.mocked(countOpenSeatsByApp).mockResolvedValue(new Map());
    const updated = stubDb([{ id: 7, owner_user_id: 70, name: "가계부" }], []);

    const res = await run();
    const body = (await res.json()) as { cleared: number };

    expect(body.cleared).toBe(1);
    expect(updated).toEqual([7]);
    const note = vi.mocked(createNotification).mock.calls[0]?.[0];
    expect(note?.type).toBe("boost_expired");
    expect(note?.link).toBe("/paid-testers?app=7");
    expect(note?.body).not.toContain("다시 켜면");
  });

  test("expiring boost on an app with open paid seats gets no D-1 notice — the daily sweep extends it", async () => {
    vi.mocked(createNotification).mockClear();
    vi.mocked(countOpenSeatsByApp).mockResolvedValue(new Map([[8, 2]]));
    stubDb(
      [],
      [{ id: 8, owner_user_id: 80, name: "일기", boost_deadline_at: new Date().toISOString() }],
    );

    const res = await run();
    const body = (await res.json()) as { notified: number };

    expect(body.notified).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  test("expiring boost without open seats gets a D-1 notice without the old free renew button", async () => {
    vi.mocked(createNotification).mockClear();
    vi.mocked(countOpenSeatsByApp).mockResolvedValue(new Map());
    stubDb(
      [],
      [{ id: 9, owner_user_id: 90, name: "메모", boost_deadline_at: new Date().toISOString() }],
    );

    const res = await run();
    const body = (await res.json()) as { notified: number };

    expect(body.notified).toBe(1);
    const note = vi.mocked(createNotification).mock.calls[0]?.[0];
    expect(note?.type).toBe("boost_expiring");
    expect(note?.body).not.toContain("갱신 +7일");
    expect(note?.link).toBe("/paid-testers?app=9");
  });

  test("sends no D-1 notices when open seats cannot be counted", async () => {
    vi.mocked(createNotification).mockClear();
    vi.mocked(countOpenSeatsByApp).mockResolvedValue(null);
    stubDb(
      [],
      [{ id: 10, owner_user_id: 100, name: "날씨", boost_deadline_at: new Date().toISOString() }],
    );

    const res = await run();
    const body = (await res.json()) as { notified: number };

    expect(body.notified).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  test("keeps an expired boost while the app still has open paid seats", async () => {
    vi.mocked(createNotification).mockClear();
    vi.mocked(countOpenSeatsByApp).mockResolvedValue(new Map([[11, 2]]));
    const updated = stubDb([{ id: 11, owner_user_id: 110, name: "운동" }], []);

    const res = await run();
    const body = (await res.json()) as { cleared: number };

    expect(body.cleared).toBe(0);
    expect(updated).toEqual([]);
    expect(createNotification).not.toHaveBeenCalled();
  });

  test("clears nothing when open seats cannot be counted", async () => {
    vi.mocked(createNotification).mockClear();
    vi.mocked(countOpenSeatsByApp).mockResolvedValue(null);
    const updated = stubDb([{ id: 12, owner_user_id: 120, name: "독서" }], []);

    const res = await run();
    const body = (await res.json()) as { cleared: number };

    expect(body.cleared).toBe(0);
    expect(updated).toEqual([]);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
