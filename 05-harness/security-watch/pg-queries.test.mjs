import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { snapshotMessages } from "../../03-output/infra/azure/cron-functions/src/pgss-snapshot.js";
import {
  buildBaseline,
  classifyQuery,
  judgeDbQueries,
  parseSnapshots,
  publicTablesFrom,
} from "./pg-queries.mjs";

const PUBLIC = new Set(["apps", "users", "matches", "waitlist_signups"]);
const NOW = new Date("2026-11-05T22:00:00Z"); // 07:00 KST, two days after the baseline date
const AT = "2026-11-05T21:30:00.000Z";
const PREV = "2026-11-04T21:30:00.000Z";
const SINCE = "2026-10-26T14:41:33.000Z";

const POSTGREST_READ =
  'WITH pgrst_source AS ( SELECT "public"."apps"."id", "public"."apps"."name" FROM "public"."apps" WHERE "public"."apps"."owner_id" = $1 ) SELECT null::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $2) AS body FROM ( SELECT * FROM pgrst_source ) _postgrest_t';

function e(over = {}) {
  return { role: "service_role", db: "testermatch", queryid: "1", calls: 10, rows: 10, since: SINCE, text: POSTGREST_READ, ...over };
}

function snap(at, entries, info = {}) {
  return { at, info: { dealloc: 0, statsReset: "2026-10-04T17:29:17.000Z", ...info }, error: null, parts: 1, received: 1, complete: true, entries };
}

const captured = (entries) => ({ captureOn: "2026-11-03", capturedAt: "2026-11-03T00:00:00Z", entries });
const collecting = { captureOn: "2026-11-03", capturedAt: null, entries: [] };

function judge({ latest, previous, baseline = captured([]), now = NOW }) {
  const snapshots = [snap(AT, latest), ...(previous ? [snap(PREV, previous)] : [])];
  return judgeDbQueries({ snapshots, baseline, publicTables: PUBLIC, now });
}

const texts = (items, status) => items.filter((i) => !status || i.status === status).map((i) => i.text);

describe("publicTablesFrom", () => {
  it("reads public table names from migrations and skips other schemas", () => {
    const names = publicTablesFrom([
      "create table public.apps (id bigint);\ncreate table if not exists matches (id int);",
      'create table "public"."users" (id int); create table auth.secret (x int); create temp table t (x int);',
    ]);
    assert.deepEqual([...names].sort(), ["apps", "matches", "users"]);
  });
});

describe("parseSnapshots", () => {
  it("reassembles the parts the Function App writes, newest first", () => {
    const entries = Array.from({ length: 12 }, (_, i) => ({
      role: "authenticated", db: "testermatch", queryid: `-9${i}`, calls: "3", rows: "3", stats_since: SINCE, query: `select ${"x".repeat(200)} from public.apps where id = $${i}`,
    }));
    const today = snapshotMessages({ at: AT, info: { dealloc: 0 }, entries, maxChars: 1_000 });
    const yesterday = snapshotMessages({ at: PREV, info: { dealloc: 0 }, entries: entries.slice(0, 2) });
    assert.ok(today.length > 1);
    const traces = [...today.reverse(), ...yesterday, "Executing 'Functions.checkin-reminder'"].map((message) => ({ message }));
    const [latest, previous] = parseSnapshots(traces);
    assert.equal(latest.at, AT);
    assert.equal(latest.complete, true);
    assert.equal(latest.entries.length, 12);
    assert.deepEqual(latest.entries[0], { role: "authenticated", db: "testermatch", queryid: "-90", calls: 3, rows: 3, since: SINCE, text: entries[0].query });
    assert.equal(previous.entries.length, 2);
  });

  it("marks a run with a missing part incomplete and skips broken lines", () => {
    const msg = (part) => ({ message: `secwatch-pgss ${JSON.stringify({ v: 1, at: AT, info: {}, part, parts: 3, rows: [] })}` });
    const [s] = parseSnapshots([msg(1), msg(3), { message: "secwatch-pgss {not json" }]);
    assert.equal(s.complete, false);
    assert.equal(s.received, 2);
  });
});

describe("classifyQuery", () => {
  it("reads PostgREST's CTE shape as a SELECT on the real table", () => {
    const c = classifyQuery(POSTGREST_READ, { role: "service_role", publicTables: PUBLIC });
    assert.equal(c.verb, "SELECT");
    assert.deepEqual(c.tables, ["public.apps"]);
    assert.equal(c.hasWhere, true);
  });

  it("finds the write inside a PostgREST CTE and ignores the function call in FROM", () => {
    const c = classifyQuery(
      'WITH pgrst_source AS (INSERT INTO "public"."apps"("name") SELECT "pgrst_body"."name" FROM json_populate_recordset (null::"public"."apps", $1) "pgrst_body" RETURNING "public"."apps".*) SELECT $2',
      { role: "authenticated", publicTables: PUBLIC },
    );
    assert.equal(c.verb, "INSERT");
    assert.deepEqual(c.tables, ["public.apps"]);
  });

  it("resolves GoTrue's unqualified names to auth", () => {
    const c = classifyQuery("SELECT * FROM users WHERE instance_id = $1 and id = $2 LIMIT $3", { role: "supabase_auth_admin", publicTables: PUBLIC });
    assert.deepEqual(c.tables, ["auth.users"]);
    assert.equal(c.touchesPublic, false);
    assert.deepEqual(classifyQuery('INSERT INTO "identities" ("id") VALUES ($1)', { role: "supabase_auth_admin" }).tables, ["auth.identities"]);
  });

  it("sees GoTrue reaching into public, qualified or by a public-only name", () => {
    const opts = { role: "supabase_auth_admin", publicTables: PUBLIC };
    assert.equal(classifyQuery("select * from public.users", opts).touchesPublic, true);
    assert.equal(classifyQuery("select id, name from apps", opts).touchesPublic, true);
    assert.equal(classifyQuery("SET search_path = '…'", opts).setsSearchPath, true);
  });

  it("tells COPY exports from imports", () => {
    assert.equal(classifyQuery("COPY public.users TO STDOUT").copy, "to");
    assert.equal(classifyQuery("COPY public.users (id, email) FROM STDIN").copy, "from");
    const sub = classifyQuery("COPY (SELECT * FROM auth.users) TO '…'");
    assert.equal(sub.copy, "to");
    assert.deepEqual(sub.tables, ["auth.users"]);
  });

  it("does not take locking clauses or comments for tables or verbs", () => {
    const c = classifyQuery("-- seat-reward-release\nselect id from matches where status = $1 for update skip locked", { role: "service_role" });
    assert.equal(c.verb, "SELECT");
    assert.deepEqual(c.tables, ["public.matches"]);
  });
});

describe("judgeDbQueries", () => {
  it("is unknown when the Function App has not written a snapshot", () => {
    const items = judgeDbQueries({ snapshots: [snap("2026-11-03T21:30:00.000Z", [])], baseline: captured([]), now: NOW });
    assert.deepEqual(items.map((i) => i.status), ["unknown"]);
  });

  it("reports a failed snapshot as unknown with the reason", () => {
    const failed = { ...snap(AT, []), error: "password authentication failed", complete: false };
    assert.match(texts(judgeDbQueries({ snapshots: [failed], baseline: captured([]), now: NOW }))[0], /password authentication failed/);
  });

  it("judges only shapes whose calls grew since yesterday", () => {
    const copy = e({ queryid: "7", text: "COPY public.users TO STDOUT", calls: 1, rows: 1400 });
    const quiet = judge({ latest: [copy], previous: [copy] });
    assert.deepEqual(texts(quiet, "danger"), []);
    const again = judge({ latest: [{ ...copy, calls: 2, rows: 2800 }], previous: [copy] });
    assert.match(texts(again, "danger")[0], /^COPY 내보내기 — service_role@testermatch COPY public\.users · 1회 1,400행 · queryid 7$/);
  });

  it("flags GoTrue touching public even when the shape is in the baseline", () => {
    const g = e({ role: "supabase_auth_admin", queryid: "8", text: "select email from public.users where id = $1" });
    const items = judge({ latest: [{ ...g, calls: 11 }], previous: [g], baseline: captured([g]) });
    assert.match(texts(items, "danger")[0], /^GoTrue 역할이 public 스키마 접근/);
  });

  it("warns on new shapes after the baseline, grouped by role", () => {
    const known = e({ queryid: "1" });
    const a = e({ role: "tmadmin", queryid: "21", text: "select count(*) from public.matches where status = $1" });
    const b = e({ role: "tmadmin", queryid: "22", text: "select id from public.apps where id = $1" });
    const items = judge({ latest: [{ ...known, calls: 20 }, a, b], previous: [known], baseline: captured([known]) });
    assert.deepEqual(texts(items, "warn"), [
      "처음 보는 쿼리 형태 2개 — tmadmin@testermatch: SELECT public.matches (queryid 21), SELECT public.apps (queryid 22)",
    ]);
    assert.deepEqual(texts(items, "danger"), []);
  });

  it("calls an unknown full read of a personal-data table danger, but only a warning while collecting", () => {
    const dump = e({ queryid: "30", text: 'WITH pgrst_source AS ( SELECT "public"."users".* FROM "public"."users" ) SELECT $1', calls: 1, rows: 1464 });
    assert.match(texts(judge({ latest: [dump], previous: [] }), "danger")[0], /^개인정보 테이블 전체 조회 \(기준선에 없는 형태\)/);
    const early = judge({ latest: [dump], previous: [], baseline: collecting, now: new Date("2026-10-30T22:00:00Z") });
    assert.deepEqual(texts(early, "danger"), []);
    assert.match(texts(early, "warn")[0], /기준선 전 — 정상 기능인지 확인/);
  });

  it("flags a big read by rows per call", () => {
    const big = e({ queryid: "31", text: "select id from public.matches where id > $1", calls: 2, rows: 2000 });
    assert.match(texts(judge({ latest: [big], previous: [] }), "danger")[0], /^한 번에 1,000행 조회/);
  });

  it("warns when the statistics were reset or entries were evicted", () => {
    const snapshots = [snap(AT, [], { statsReset: "2026-11-05T03:00:00.000Z", dealloc: 4 }), snap(PREV, [], { dealloc: 1 })];
    const items = judgeDbQueries({ snapshots, baseline: captured([]), now: NOW });
    assert.equal(texts(items, "warn").length, 2);
    assert.match(texts(items, "warn")[0], /통계 초기화됨/);
    assert.match(texts(items, "warn")[1], /3개가 기록에서 밀려남/);
  });

  it("collapses a mostly-unknown day into one re-baseline warning", () => {
    const latest = Array.from({ length: 12 }, (_, i) => e({ queryid: `n${i}` }));
    const items = judge({ latest, previous: [], baseline: captured([e({ queryid: "n0" })]) });
    assert.equal(texts(items, "warn").length, 1);
    assert.match(texts(items, "warn")[0], /12개 중 11개가 기준선에 없음/);
  });

  it("without yesterday's snapshot judges only shapes first seen in the last 26 hours", () => {
    const old = e({ queryid: "40", text: "COPY public.users TO STDOUT" });
    const fresh = e({ queryid: "41", text: "COPY public.apps TO STDOUT", since: "2026-11-05T09:00:00.000Z" });
    const items = judgeDbQueries({ snapshots: [snap(AT, [old, fresh])], baseline: captured([]), now: NOW });
    assert.equal(texts(items, "danger").length, 1);
    assert.match(texts(items, "danger")[0], /queryid 41/);
    assert.match(texts(items, "ok")[0], /비교할 전날 스냅샷 없음/);
  });

  it("says when the baseline is still being collected and when it is overdue", () => {
    const quiet = [e()];
    const before = judge({ latest: quiet, previous: quiet, baseline: collecting, now: new Date("2026-10-30T22:00:00Z") });
    assert.match(texts(before, "ok").join("\n"), /기준선 수집 중 — 형태 1개, 2026-11-03 캡처 예정/);
    const after = judge({ latest: quiet, previous: quiet, baseline: collecting });
    assert.match(texts(after, "warn")[0], /기준선 캡처 기한\(2026-11-03\) 지남/);
  });

  it("never copies SQL text into the report", () => {
    const leaky = [
      e({ queryid: "50", text: "COPY (select secret_marker_x from public.users) TO STDOUT" }),
      e({ role: "tmadmin", queryid: "51", text: "select secret_marker_y from public.apps where id = $1" }),
    ];
    const all = texts(judge({ latest: leaky, previous: [] })).join("\n");
    assert.doesNotMatch(all, /secret_marker/);
  });
});

describe("buildBaseline", () => {
  const snapshot = snap(AT, [
    e({ queryid: "1" }),
    e({ queryid: "2", text: "select * from public.users" }),
    e({ role: "tmadmin", queryid: "3", text: "select id from public.apps where id = $1" }),
  ]);

  it("leaves rule hits out unless allowed and keeps the capture date", () => {
    const { baseline, added, flagged } = buildBaseline({ snapshot, existing: collecting, publicTables: PUBLIC, capturedAt: "2026-11-03T01:00:00Z" });
    assert.deepEqual(added.map((x) => x.queryid), ["1", "3"]);
    assert.deepEqual(flagged.map((x) => [x.queryid, x.reason]), [["2", "개인정보 테이블 전체 조회"]]);
    assert.equal(baseline.captureOn, "2026-11-03");
    assert.equal(baseline.snapshotAt, AT);
    assert.deepEqual(baseline.entries[0], { role: "service_role", db: "testermatch", queryid: "1", verb: "SELECT", tables: ["public.apps"] });
    assert.ok(baseline.entries.every((x) => !("text" in x)));
    const allowed = buildBaseline({ snapshot, existing: collecting, publicTables: PUBLIC, allow: ["2"], capturedAt: "t" });
    assert.equal(allowed.baseline.entries.length, 3);
  });

  it("merges into an existing baseline without duplicates", () => {
    const existing = captured([{ role: "tmadmin", db: "testermatch", queryid: "3", verb: "SELECT", tables: ["public.apps"] }]);
    const { baseline, added } = buildBaseline({ snapshot, existing, publicTables: PUBLIC, merge: true, capturedAt: "t" });
    assert.deepEqual(added.map((x) => x.queryid), ["1"]);
    assert.deepEqual(baseline.entries.map((x) => x.queryid), ["1", "3"]);
  });
});
