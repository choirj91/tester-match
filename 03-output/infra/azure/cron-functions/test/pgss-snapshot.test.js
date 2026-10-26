import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENTRIES_SQL,
  errorMessage,
  INFO_SQL,
  runSnapshot,
  scrubError,
  scrubQuery,
  snapshotMessages,
  takeSnapshot,
  TRACE_PREFIX,
} from "../src/pgss-snapshot.js";

const parse = (m) => JSON.parse(m.slice(TRACE_PREFIX.length));

function entry(over = {}) {
  return {
    role: "service_role",
    db: "testermatch",
    queryid: "-4611686018427387904",
    calls: "42",
    rows: "40",
    stats_since: new Date("2026-10-26T14:41:33Z"),
    query: 'WITH pgrst_source AS (SELECT "public"."apps".* FROM "public"."apps" WHERE "public"."apps"."id" = $1) SELECT 1',
    ...over,
  };
}

test("blanks string literals and dollar-quoted bodies the extension leaves in utility commands", () => {
  assert.equal(scrubQuery("ALTER ROLE x PASSWORD 'hunter2'"), "ALTER ROLE x PASSWORD '…'");
  assert.equal(scrubQuery("SELECT 'it''s', $1"), "SELECT '…', $1");
  assert.equal(scrubQuery("DO $body$ begin perform 'x'; -- y\n end $body$"), "DO $$…$$");
  assert.equal(scrubQuery("select\n  $1,\t$2"), "select $1, $2");
});

test("is not fooled by escapes, comments, quoted identifiers or a missing closing quote", () => {
  assert.equal(scrubQuery("select E'ab\\'cd' as x"), "select E'…' as x");
  assert.equal(scrubQuery("select 1 -- don't\n, 'secret'"), "select 1 , '…'");
  assert.equal(scrubQuery("/* it's */ select 'a'"), "select '…'");
  assert.equal(scrubQuery('select "it\'s" from t where x = \'s\''), 'select "it\'s" from t where x = \'…\'');
  assert.equal(scrubQuery("alter role x password 'unterminated secret"), "alter role x password '…'");
});

test("keeps setting names so set_config('search_path', …) can be judged", () => {
  assert.equal(scrubQuery("select set_config('search_path', $1, true)"), "select set_config('search_path', $1, true)");
});

test("caps long query text", () => {
  const out = scrubQuery(`select ${"a, ".repeat(4000)}b`);
  assert.equal(out.length, 6001);
  assert.ok(out.endsWith("…"));
});

test("scrubs a very long text in linear time", () => {
  const started = Date.now();
  scrubQuery("$t1$".repeat(100_000));
  assert.ok(Date.now() - started < 500);
});

test("hides IP addresses in connection errors", () => {
  assert.equal(scrubError("connect ETIMEDOUT 20.41.1.2:5432"), "connect ETIMEDOUT x.x.x.x:5432");
  assert.equal(scrubError("connect ECONNREFUSED 2001:db8::1:5432"), "connect ECONNREFUSED x:x::x");
});

test("the entries query keeps this role's own queries and bounds the text in SQL", () => {
  assert.ok(ENTRIES_SQL.includes("left(s.query, 20000)"));
  assert.ok(ENTRIES_SQL.includes("s.queryid::text"));
  assert.ok(!ENTRIES_SQL.includes("current_user"));
  assert.ok(INFO_SQL.includes("pg_stat_statements.track_utility"));
});

test("keeps queryid as a string and leaves azuresu out with a count", () => {
  const [m] = snapshotMessages({
    at: "2026-10-27T21:30:00.000Z",
    info: { dealloc: 0 },
    entries: [entry(), entry({ role: "azuresu", db: "azure_sys" }), entry({ role: "azuresu" })],
  });
  const d = parse(m);
  assert.equal(d.v, 1);
  assert.deepEqual(d.info, { dealloc: 0, ignored: { azuresu: 2 } });
  assert.deepEqual(d.rows, [
    ["service_role", "testermatch", "-4611686018427387904", 42, 40, "2026-10-26T14:41:33.000Z", entry().query],
  ]);
});

test("splits into numbered parts that each stay under the size limit", () => {
  const entries = Array.from({ length: 30 }, (_, i) => entry({ queryid: String(i), query: `select ${"x".repeat(300)} ${i}` }));
  const messages = snapshotMessages({ at: "t", info: {}, entries, maxChars: 2_000 });
  const parts = messages.map(parse);
  assert.ok(parts.length > 1);
  assert.deepEqual(parts.map((p) => p.part), parts.map((_, i) => i + 1));
  assert.ok(parts.every((p) => p.parts === parts.length && p.at === "t"));
  assert.equal(parts.flatMap((p) => p.rows).length, 30);
  for (const p of parts) assert.ok(JSON.stringify(p.rows).length <= 2_000 + 2);
});

test("a row larger than the limit gets a part of its own instead of being dropped", () => {
  const entries = [entry({ queryid: "a" }), entry({ queryid: "b", query: `select ${"y".repeat(3_000)}` }), entry({ queryid: "c" })];
  const parts = snapshotMessages({ at: "t", info: {}, entries, maxChars: 1_000 }).map(parse);
  assert.deepEqual(parts.map((p) => p.rows.map((r) => r[2])), [["a"], ["b"], ["c"]]);
});

test("an empty snapshot is still one message, so the watch can tell it ran", () => {
  const messages = snapshotMessages({ at: "t", info: {}, entries: [] });
  assert.equal(messages.length, 1);
  assert.deepEqual(parse(messages[0]).rows, []);
});

test("error message carries the run time and a scrubbed reason", () => {
  const d = parse(errorMessage({ at: "t", error: "no pg_hba.conf entry for host 1.2.3.4" }));
  assert.deepEqual(d, { v: 1, at: "t", part: 1, parts: 1, error: "no pg_hba.conf entry for host x.x.x.x" });
});

test("takeSnapshot reads the info row, including the collection settings, and the entries", async () => {
  const seen = [];
  const client = {
    query: async (sql) => {
      seen.push(sql);
      if (sql === INFO_SQL) {
        return {
          rows: [{ dealloc: "3", stats_reset: new Date("2026-10-04T17:29:17Z"), server_version: "17.5", track: "top", track_utility: "on", compute_query_id: "auto" }],
        };
      }
      return { rows: [entry()] };
    },
  };
  const [m] = await takeSnapshot(client, "2026-10-27T21:30:00.000Z");
  assert.deepEqual(seen, [INFO_SQL, ENTRIES_SQL]);
  assert.deepEqual(parse(m).info, {
    dealloc: 3, statsReset: "2026-10-04T17:29:17.000Z", serverVersion: "17.5", track: "top", trackUtility: "on", computeQueryId: "auto", ignored: {},
  });
});

function fakeClient({ failOn } = {}) {
  const made = [];
  class Client {
    constructor(config) {
      this.config = config;
      this.listeners = {};
      this.ended = false;
      made.push(this);
    }
    on(event, fn) {
      this.listeners[event] = fn;
    }
    async connect() {
      if (failOn === "connect") throw new Error("connect ETIMEDOUT 10.0.0.9:5432");
    }
    async query(sql) {
      if (sql === INFO_SQL) return { rows: [{ dealloc: "0", stats_reset: null, server_version: "17.11" }] };
      return { rows: [entry()] };
    }
    async end() {
      this.ended = true;
    }
  }
  return { Client, made };
}

const ENV = {
  SECWATCH_PG_ENABLED: "1",
  SECWATCH_PG_HOST: "db.example.test",
  SECWATCH_PG_USER: "secwatch_reader",
  SECWATCH_PG_PASSWORD: "pw",
};

test("runSnapshot does nothing until SECWATCH_PG_ENABLED=1", async () => {
  const { Client, made } = fakeClient();
  const logs = [];
  assert.equal(await runSnapshot({ env: { ...ENV, SECWATCH_PG_ENABLED: "0" }, Client, log: (m) => logs.push(m) }), false);
  assert.equal(made.length, 0);
  assert.match(logs[0], /skipped/);
});

test("runSnapshot connects read-only with timeouts, listens for socket errors and logs the snapshot", async () => {
  const { Client, made } = fakeClient();
  const logs = [];
  const ok = await runSnapshot({ env: ENV, Client, log: (m) => logs.push(m), now: () => new Date("2026-10-27T21:30:00Z") });
  assert.equal(ok, true);
  const [c] = made;
  assert.deepEqual(
    { ...c.config, password: "…" },
    {
      host: "db.example.test", user: "secwatch_reader", password: "…", database: "postgres", ssl: true,
      application_name: "secwatch-pg-snapshot", connectionTimeoutMillis: 15_000, statement_timeout: 15_000, query_timeout: 30_000,
      options: "-c default_transaction_read_only=on",
    },
  );
  assert.equal(typeof c.listeners.error, "function");
  c.listeners.error(new Error("read ECONNRESET 10.0.0.9:5432")); // must not throw
  assert.equal(c.ended, true);
  assert.equal(parse(logs.find((m) => m.startsWith(TRACE_PREFIX))).at, "2026-10-27T21:30:00.000Z");
  assert.ok(logs.every((m) => !m.includes("10.0.0.9")));
});

test("runSnapshot logs a scrubbed error trace, closes the client and rethrows", async () => {
  const { Client, made } = fakeClient({ failOn: "connect" });
  const logs = [];
  await assert.rejects(runSnapshot({ env: ENV, Client, log: (m) => logs.push(m), now: () => new Date("2026-10-27T21:30:00Z") }), /ETIMEDOUT/);
  assert.equal(made[0].ended, true);
  assert.deepEqual(parse(logs.at(-1)), { v: 1, at: "2026-10-27T21:30:00.000Z", part: 1, parts: 1, error: "connect ETIMEDOUT x.x.x.x:5432" });
});
