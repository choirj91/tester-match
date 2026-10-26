import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ENTRIES_SQL,
  errorMessage,
  INFO_SQL,
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
  assert.equal(scrubQuery("DO $body$ begin perform 'x'; end $body$"), "DO $$…$$");
  assert.equal(scrubQuery("select\n  $1,\t$2"), "select $1, $2");
});

test("caps long query text", () => {
  const out = scrubQuery(`select ${"a, ".repeat(2000)}b`);
  assert.equal(out.length, 2001);
  assert.ok(out.endsWith("…"));
});

test("hides IP addresses in connection errors", () => {
  assert.equal(scrubError("connect ETIMEDOUT 20.41.1.2:5432"), "connect ETIMEDOUT x.x.x.x:5432");
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

test("an empty snapshot is still one message, so the watch can tell it ran", () => {
  const messages = snapshotMessages({ at: "t", info: {}, entries: [] });
  assert.equal(messages.length, 1);
  assert.deepEqual(parse(messages[0]).rows, []);
});

test("error message carries the run time and a scrubbed reason", () => {
  const d = parse(errorMessage({ at: "t", error: "no pg_hba.conf entry for host 1.2.3.4" }));
  assert.deepEqual(d, { v: 1, at: "t", part: 1, parts: 1, error: "no pg_hba.conf entry for host x.x.x.x" });
});

test("takeSnapshot reads the info row and the entries", async () => {
  const seen = [];
  const client = {
    query: async (sql) => {
      seen.push(sql);
      if (sql === INFO_SQL) {
        return { rows: [{ dealloc: "3", stats_reset: new Date("2026-10-04T17:29:17Z"), server_version: "17.5" }] };
      }
      return { rows: [entry()] };
    },
  };
  const [m] = await takeSnapshot(client, "2026-10-27T21:30:00.000Z");
  assert.deepEqual(seen, [INFO_SQL, ENTRIES_SQL]);
  assert.deepEqual(parse(m).info, { dealloc: 3, statsReset: "2026-10-04T17:29:17.000Z", serverVersion: "17.5", ignored: {} });
});
