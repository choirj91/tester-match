// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

type UserRow = { id: number; email: string };
type AppRow = {
  owner_user_id: number;
  name: string;
  store_invite_url: string | null;
  status: string;
};

const db = vi.hoisted(() => ({
  users: [] as UserRow[],
  apps: [] as AppRow[],
  failAppLookup: false,
  failNextAppInsert: false,
}));

vi.mock("@/lib/admin", () => ({
  getAdminUser: async () => ({ id: 1, role: "admin" }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => (table === "users" ? usersTable() : appsTable()),
  }),
}));

function usersTable() {
  return {
    select: () => ({
      eq: (_col: string, email: string) => ({
        maybeSingle: async () => ({
          data: db.users.find((u) => u.email === email) ?? null,
          error: null,
        }),
      }),
    }),
    insert: (row: { email: string }) => ({
      select: () => ({
        single: async () => {
          const created = { id: db.users.length + 1, email: row.email };
          db.users.push(created);
          return { data: { id: created.id }, error: null };
        },
      }),
    }),
  };
}

// PostgREST 처럼 select 에 적힌 컬럼만 돌려주고, 필터도 적힌 컬럼으로만 건다 —
// 라우트가 컬럼을 빠뜨리거나 다른 컬럼으로 거르면 테스트가 깨지도록.
function appsTable() {
  return {
    select: (columns: string) => ({
      eq: (ownerCol: keyof AppRow, ownerId: number) => ({
        neq: async (statusCol: keyof AppRow, excluded: string) => {
          if (db.failAppLookup) return { data: null, error: { message: "boom" } };
          const picked = columns.split(",").map((c) => c.trim()) as (keyof AppRow)[];
          const data = db.apps
            .filter((a) => a[ownerCol] === ownerId && a[statusCol] !== excluded)
            .map((a) => Object.fromEntries(picked.map((c) => [c, a[c]])));
          return { data, error: null };
        },
      }),
    }),
    insert: async (row: AppRow) => {
      if (db.failNextAppInsert) {
        db.failNextAppInsert = false;
        return { error: { message: "insert boom" } };
      }
      db.apps.push({ ...row, store_invite_url: row.store_invite_url ?? null });
      return { error: null };
    },
  };
}

import { POST } from "./route";

const STORE_URL = "https://play.google.com/apps/test/com.example.fridge/1";
const fridge = { email: "alice@example.com", app_name: "MagicFridge", store_invite_url: STORE_URL };

type ImportResponse = {
  imported: number;
  skipped: number;
  placeholders_created: number;
  errors: { row: number; email?: string; reason: string }[];
  duplicates: { row: number; email: string; app_name: string }[];
};

async function importRows(rows: unknown[]): Promise<ImportResponse> {
  const res = await POST(
    new Request("http://localhost/api/admin/apps/import", {
      method: "POST",
      body: JSON.stringify(rows),
    }),
  );
  return (await res.json()) as ImportResponse;
}

describe("POST /api/admin/apps/import — duplicate guard", () => {
  beforeEach(() => {
    db.users = [];
    db.apps = [];
    db.failAppLookup = false;
    db.failNextAppInsert = false;
  });

  it("imports a row repeated inside one batch only once", async () => {
    const body = await importRows([fridge, fridge]);

    expect(body.imported).toBe(1);
    expect(body.duplicates).toEqual([
      { row: 2, email: "alice@example.com", app_name: "MagicFridge" },
    ]);
    expect(body.skipped).toBe(0);
    expect(db.apps).toHaveLength(1);
  });

  it("imports nothing when the same batch is submitted again", async () => {
    const batch = [fridge, { ...fridge, email: "bob@example.com", app_name: "Bob 앱" }];
    await importRows(batch);

    const second = await importRows(batch);

    expect(second.imported).toBe(0);
    expect(second.duplicates).toHaveLength(2);
    expect(second.placeholders_created).toBe(0);
    expect(db.apps).toHaveLength(2);
  });

  it("skips an app the owner already has when only case and spacing differ", async () => {
    db.users = [{ id: 7, email: "alice@example.com" }];
    db.apps = [
      { owner_user_id: 7, name: "Magic Fridge", store_invite_url: STORE_URL, status: "matching" },
    ];

    const body = await importRows([{ ...fridge, app_name: " magic  fridge " }]);

    expect(body.imported).toBe(0);
    expect(body.duplicates).toHaveLength(1);
    expect(db.apps).toHaveLength(1);
  });

  it("still imports the same app for a different owner", async () => {
    const body = await importRows([fridge, { ...fridge, email: "bob@example.com" }]);

    expect(body.imported).toBe(2);
    expect(body.duplicates).toEqual([]);
  });

  it("still imports a same-named app with a different store link", async () => {
    const body = await importRows([fridge, { ...fridge, store_invite_url: `${STORE_URL}2` }]);

    expect(body.imported).toBe(2);
    expect(body.duplicates).toEqual([]);
  });

  it("imports again when the earlier row was soft-deleted", async () => {
    db.users = [{ id: 7, email: "alice@example.com" }];
    db.apps = [
      { owner_user_id: 7, name: "MagicFridge", store_invite_url: STORE_URL, status: "deleted" },
    ];

    const body = await importRows([fridge]);

    expect(body.imported).toBe(1);
    expect(db.apps).toHaveLength(2);
  });

  it("does not insert when the existing-app lookup fails", async () => {
    db.users = [{ id: 7, email: "alice@example.com" }];
    db.failAppLookup = true;

    const body = await importRows([fridge]);

    expect(body.imported).toBe(0);
    expect(body.errors).toEqual([
      { row: 1, email: "alice@example.com", reason: "app_lookup_failed: boom" },
    ]);
    expect(db.apps).toHaveLength(0);
  });

  it("retries a repeated row when its first insert failed", async () => {
    db.failNextAppInsert = true;

    const body = await importRows([fridge, fridge]);

    expect(body.imported).toBe(1);
    expect(body.duplicates).toEqual([]);
    expect(body.errors).toEqual([
      { row: 1, email: "alice@example.com", reason: "app_insert_failed: insert boom" },
    ]);
    expect(db.apps).toHaveLength(1);
  });

  it("skips a link-less app the owner already has without a link", async () => {
    db.users = [{ id: 7, email: "alice@example.com" }];
    db.apps = [{ owner_user_id: 7, name: "MagicFridge", store_invite_url: null, status: "paused" }];

    const body = await importRows([{ email: "alice@example.com", app_name: "MagicFridge" }]);

    expect(body.imported).toBe(0);
    expect(body.duplicates).toHaveLength(1);
  });
});
