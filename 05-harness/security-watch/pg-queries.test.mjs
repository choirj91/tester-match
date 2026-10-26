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

const PUBLIC = new Set(["apps", "users", "matches", "payments", "waitlist_signups"]);
const NOW = new Date("2026-11-05T22:00:00Z"); // 07:00 KST, two days after the baseline date
const AT = "2026-11-05T21:30:00.000Z";
const PREV = "2026-11-04T21:30:00.000Z";
const SINCE = "2026-10-26T14:41:33.000Z";

const POSTGREST_READ =
  'WITH pgrst_source AS ( SELECT "public"."apps"."id", "public"."apps"."name" FROM "public"."apps" WHERE "public"."apps"."owner_id" = $1 ) SELECT null::bigint AS total_result_set, pg_catalog.count(_postgrest_t) AS page_total, coalesce(json_agg(_postgrest_t), $2) AS body FROM ( SELECT * FROM pgrst_source ) _postgrest_t';
const USER_BY_ID = 'WITH pgrst_source AS ( SELECT "public"."users"."nickname" FROM "public"."users" WHERE "public"."users"."id" = $1 ) SELECT coalesce(json_agg(_postgrest_t), $2) AS body FROM ( SELECT * FROM pgrst_source ) _postgrest_t';

function e(over = {}) {
  return { role: "service_role", db: "testermatch", queryid: "1", calls: 10, rows: 10, since: SINCE, text: POSTGREST_READ, ...over };
}

function snap(at, entries, info = {}) {
  return {
    at,
    info: { dealloc: 0, statsReset: "2026-10-04T17:29:17.000Z", track: "top", trackUtility: "on", computeQueryId: "auto", ...info },
    error: null, parts: 1, received: 1, complete: true, entries,
  };
}

const captured = (entries) => ({ captureOn: "2026-11-03", capturedAt: "2026-11-03T00:00:00Z", entries });
const collecting = { captureOn: "2026-11-03", capturedAt: null, entries: [] };

function judge({ latest, previous, baseline = captured([]), now = NOW, ...rest }) {
  const snapshots = [snap(AT, latest), ...(previous ? [snap(PREV, previous)] : [])];
  return judgeDbQueries({ snapshots, baseline, publicTables: PUBLIC, now, ...rest });
}

const texts = (items, status) => items.filter((i) => !status || i.status === status).map((i) => i.text);
const cls = (text, role = "service_role") => classifyQuery(text, { role, publicTables: PUBLIC });

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

  it("marks a run with a missing part incomplete and skips broken lines and malformed rows", () => {
    const msg = (part, rows = []) => ({ message: `secwatch-pgss ${JSON.stringify({ v: 1, at: AT, info: {}, part, parts: 3, rows })}` });
    const [s] = parseSnapshots([msg(1, "not rows"), msg(3, [["only", "three", "cells"]]), { message: "secwatch-pgss {not json" }]);
    assert.equal(s.complete, false);
    assert.equal(s.received, 2);
    assert.deepEqual(s.entries, []);
  });

  it("keeps the error of a failed run", () => {
    const [s] = parseSnapshots([{ message: `secwatch-pgss ${JSON.stringify({ v: 1, at: AT, part: 1, parts: 1, error: "timeout" })}` }]);
    assert.equal(s.error, "timeout");
    assert.equal(s.complete, false);
  });
});

describe("classifyQuery", () => {
  it("reads PostgREST's CTE shape as a SELECT on the real table", () => {
    const c = cls(POSTGREST_READ);
    assert.equal(c.verb, "SELECT");
    assert.deepEqual(c.tables, ["public.apps"]);
    assert.deepEqual(c.piiUnfiltered, []);
  });

  it("finds the write inside a PostgREST CTE and ignores the function call in FROM", () => {
    const c = cls('WITH pgrst_source AS (INSERT INTO "public"."apps"("name") SELECT "pgrst_body"."name" FROM json_populate_recordset (null::"public"."apps", $1) "pgrst_body" RETURNING "public"."apps".*) SELECT $2', "authenticated");
    assert.equal(c.verb, "INSERT");
    assert.deepEqual(c.tables, ["public.apps"]);
    assert.deepEqual(c.sources, []);
  });

  it("resolves GoTrue's unqualified names to auth", () => {
    const c = cls("SELECT * FROM users WHERE instance_id = $1 and id = $2 LIMIT $3", "supabase_auth_admin");
    assert.deepEqual(c.tables, ["auth.users"]);
    assert.equal(c.touchesPublic, false);
    assert.deepEqual(cls('INSERT INTO "identities" ("id") VALUES ($1)', "supabase_auth_admin").tables, ["auth.identities"]);
  });

  it("sees GoTrue reaching into public: qualified, by a public-only name, in a comma join, or via search_path", () => {
    const g = (sql) => cls(sql, "supabase_auth_admin");
    assert.equal(g("select * from public.users").touchesPublic, true);
    assert.equal(g("select id, name from apps").touchesPublic, true);
    assert.equal(g("select * from users u, public.apps a where u.id = $1").touchesPublic, true);
    assert.equal(g("SET search_path = '…'").setsSearchPath, true);
    assert.equal(g("select set_config('search_path', $1, false)").setsSearchPath, true);
  });

  it("reads every item of a comma join, three-part names and a CTE named like a real table", () => {
    assert.deepEqual(cls("select * from public.apps, auth.users where apps.id = $1").sources.sort(), ["auth.users", "public.apps"]);
    assert.deepEqual(cls("select * from testermatch.public.users where id = $1").sources, ["public.users"]);
    assert.deepEqual(cls("WITH users AS (SELECT * FROM users) SELECT * FROM users").piiUnfiltered, ["public.users"]);
  });

  it("treats a personal-data table as read whatever the statement verb", () => {
    for (const sql of [
      "DECLARE _pg_dump_cursor CURSOR FOR SELECT * FROM ONLY public.users",
      "TABLE public.users",
      "EXPLAIN ANALYZE SELECT * FROM public.users",
      "INSERT INTO bk SELECT * FROM auth.users",
      "CREATE TABLE bk AS SELECT * FROM public.users",
      "(SELECT email FROM public.users)",
    ]) {
      assert.equal(cls(sql).piiUnfiltered.length, 1, sql);
    }
  });

  it("does not count a trivial, commented-out or other-branch WHERE as a filter", () => {
    const unfiltered = (sql) => cls(sql).piiUnfiltered.length === 1;
    assert.ok(unfiltered("SELECT * FROM public.payments WHERE true"));
    assert.ok(unfiltered("SELECT * FROM public.payments WHERE $1"));
    assert.ok(unfiltered("select * from public.users where id is not null limit $1"));
    assert.ok(unfiltered("select * from public.users /* where id = 1 */"));
    assert.ok(unfiltered("with x as (select id from public.apps where id = $1) select * from public.users"));
    assert.ok(unfiltered("select email from public.users union select name from public.apps where id = $1"));
    assert.ok(!unfiltered("select * from public.users where id = $1"));
    assert.ok(!unfiltered("select count(*) from public.users"));
  });

  it("tells COPY exports from imports and from server-side file or program access", () => {
    assert.deepEqual([cls("COPY public.users TO STDOUT").copy, cls("COPY public.users TO STDOUT").serverCopy], ["to", false]);
    assert.deepEqual([cls("COPY public.users TO STDOUT").sources, cls("COPY public.users FROM STDIN").targets], [["public.users"], ["public.users"]]);
    assert.deepEqual([cls("COPY public.users (id, email) FROM STDIN").copy, cls("COPY public.users (id) FROM STDIN").serverCopy], ["from", false]);
    assert.equal(cls("COPY public.apps FROM PROGRAM '…'").serverCopy, true);
    assert.equal(cls("COPY public.apps FROM '…'").serverCopy, true);
    const sub = cls("COPY (WITH stdin AS (SELECT 1) SELECT * FROM auth.users) TO /**/ STDOUT");
    assert.equal(sub.copy, "to");
    assert.deepEqual(sub.sources, ["auth.users"]);
  });

  it("spots role and privilege changes", () => {
    assert.equal(cls("GRANT service_role TO anon").privilege, true);
    assert.equal(cls("ALTER ROLE authenticator WITH PASSWORD '…'").privilege, true);
    assert.equal(cls("SET ROLE supabase_auth_admin").privilege, true);
    assert.equal(cls("SET client_encoding = '…'").privilege, false);
  });

  it("does not take locking clauses, comments or columns for tables or verbs", () => {
    const c = cls("-- seat-reward-release\nselect id from matches where status = $1 for update skip locked");
    assert.equal(c.verb, "SELECT");
    assert.deepEqual(c.tables, ["public.matches"]);
    assert.equal(cls("WITH x AS (SELECT 1) SELECT * FROM public.apps WHERE id = $1 -- update apps").verb, "SELECT");
    assert.deepEqual(cls("select extract(epoch from created_at) from public.apps where id = $1").tables, ["public.apps"]);
  });
});

describe("judgeDbQueries", () => {
  it("is unknown when there is no snapshot, or the newest is older than allowed", () => {
    assert.deepEqual(judgeDbQueries({ snapshots: [], baseline: captured([]), now: NOW }).map((i) => i.status), ["unknown"]);
    const stale = [snap("2026-11-05T17:00:00.000Z", [e()])];
    assert.match(texts(judgeDbQueries({ snapshots: stale, baseline: captured([]), now: NOW, maxAgeHours: 3 }))[0], /5시간 전/);
    assert.notEqual(judgeDbQueries({ snapshots: stale, baseline: captured([]), now: NOW })[0].status, "unknown");
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

  it("counts the whole entry again when its statistics were recreated", () => {
    const copy = e({ queryid: "7", text: "COPY public.users TO STDOUT", calls: 5, rows: 100 });
    const items = judge({ latest: [{ ...copy, calls: 1, since: "2026-11-05T10:00:00.000Z" }], previous: [copy] });
    assert.equal(texts(items, "danger").length, 1);
  });

  it("flags GoTrue touching public and COPY from a program even when the shape is in the baseline", () => {
    const g = e({ role: "supabase_auth_admin", queryid: "8", text: "select email from public.users where id = $1" });
    const p = e({ role: "tmadmin", queryid: "9", text: "COPY public.apps FROM PROGRAM '…'" });
    const items = judge({ latest: [{ ...g, calls: 11 }, { ...p, calls: 11 }], previous: [g, p], baseline: captured([g, p]) });
    assert.match(texts(items, "danger").join("\n"), /GoTrue 역할이 public 스키마 접근/);
    assert.match(texts(items, "danger").join("\n"), /서버 파일·명령 COPY/);
  });

  it("calls privilege changes by PostgREST roles danger and by the admin a warning", () => {
    const items = judge({
      latest: [e({ queryid: "p1", text: "GRANT service_role TO anon", role: "authenticator" }), e({ queryid: "p2", text: "ALTER ROLE x WITH PASSWORD '…'", role: "tmadmin" })],
      previous: [],
    });
    assert.match(texts(items, "danger")[0], /^PostgREST 역할의 권한 변경/);
    assert.match(texts(items, "warn")[0], /^권한·역할 변경/);
  });

  it("flags a baselined personal-data shape replayed far above its usual rate", () => {
    const base = { role: "service_role", db: "testermatch", queryid: "u1", callsPerDay: 50, rowsPerDay: 50 };
    const before = e({ queryid: "u1", text: USER_BY_ID, calls: 500, rows: 500 });
    const spike = judge({ latest: [{ ...before, calls: 5_500, rows: 5_500 }], previous: [before], baseline: captured([base]) });
    assert.match(texts(spike, "danger")[0], /^개인정보 조회가 평소보다 많음 — 하루 5,000회 5,000행 \(평소 50회 50행\)/);
    const busyDay = judge({ latest: [{ ...before, calls: 700, rows: 700 }], previous: [before], baseline: captured([base]) });
    assert.deepEqual(texts(busyDay, "danger"), []);
  });

  it("warns on new shapes after the baseline: grouped by role, personal-data ones one by one", () => {
    const known = e({ queryid: "1" });
    const a = e({ role: "tmadmin", queryid: "21", text: "select count(*) from public.matches where status = $1" });
    const b = e({ role: "tmadmin", queryid: "22", text: "select id from public.apps where id = $1" });
    const pii = e({ queryid: "23", text: USER_BY_ID });
    const items = judge({ latest: [{ ...known, calls: 20 }, a, b, pii], previous: [known], baseline: captured([known]) });
    assert.deepEqual(texts(items, "warn"), [
      "처음 보는 개인정보 테이블 쿼리 — service_role@testermatch SELECT public.users · 10회 10행 · queryid 23",
      "처음 보는 쿼리 형태 2개 — tmadmin@testermatch: SELECT public.matches (queryid 21), SELECT public.apps (queryid 22)",
    ]);
    assert.deepEqual(texts(items, "danger"), []);
  });

  it("calls an unknown full read of a personal-data table danger, but only a warning while collecting", () => {
    const dump = e({ queryid: "30", text: 'WITH pgrst_source AS ( SELECT "public"."users".* FROM "public"."users" ) SELECT $1', calls: 2, rows: 2 });
    assert.match(texts(judge({ latest: [dump], previous: [] }), "danger")[0], /^개인정보 테이블 전체 조회 \(기준선에 없는 형태\)/);
    const early = judge({ latest: [dump], previous: [], baseline: collecting, now: new Date("2026-10-30T22:00:00Z") });
    assert.deepEqual(texts(early, "danger"), []);
    assert.match(texts(early, "warn")[0], /기준선 전 — 정상 기능인지 확인/);
  });

  it("flags big reads by rows per call: 50 for personal data, 1,000 otherwise", () => {
    const pii = e({ queryid: "31", text: "select email from public.users where id > $1", calls: 2, rows: 200 });
    const big = e({ queryid: "32", text: "select id from public.matches where id > $1", calls: 2, rows: 2000 });
    const items = texts(judge({ latest: [pii, big], previous: [] }), "danger").join("\n");
    assert.match(items, /개인정보 한 번에 100행 조회/);
    assert.match(items, /한 번에 1,000행 조회/);
  });

  it("warns when statistics were reset, entries evicted, collection switched off or the snapshot is empty", () => {
    const snapshots = [snap(AT, [e()], { statsReset: "2026-11-05T03:00:00.000Z", dealloc: 4, trackUtility: "off" }), snap(PREV, [e()], { dealloc: 1 })];
    const warns = texts(judgeDbQueries({ snapshots, baseline: captured([e()]), now: NOW }), "warn").join("\n");
    assert.match(warns, /통계 초기화됨/);
    assert.match(warns, /3개가 기록에서 밀려남/);
    assert.match(warns, /쿼리 통계 수집이 꺼짐 \(track=top, track_utility=off/);
    assert.match(texts(judge({ latest: [], previous: [e()] }), "warn").join("\n"), /스냅샷이 비어 있음/);
  });

  it("warns on a second snapshot within a day", () => {
    const snapshots = [snap(AT, [e()]), snap("2026-11-05T12:00:00.000Z", [e()]), snap(PREV, [e()])];
    assert.match(texts(judgeDbQueries({ snapshots, baseline: captured([e()]), now: NOW }), "warn")[0], /하루 사이 스냅샷 2개/);
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

  it("reports the snapshot age when everything is fine", () => {
    const quiet = e();
    const items = judge({ latest: [{ ...quiet, calls: 20 }], previous: [quiet], baseline: captured([quiet]) });
    assert.match(texts(items, "ok").at(-1), /^30분 전 스냅샷 · 형태 1개 중 24시간 활동 1개 모두 기준선 안/);
  });

  it("never copies SQL text into the report and keeps names to safe characters", () => {
    const base = { role: "service_role", db: "testermatch", queryid: "52", callsPerDay: 1, rowsPerDay: 1 };
    const known = e({ queryid: "52", text: "select secret_marker_z from public.users where id = $1", calls: 1, rows: 1 });
    const leaky = [
      e({ queryid: "50", text: "COPY (select secret_marker_x from public.users) TO STDOUT" }),
      e({ role: "tmadmin", queryid: "51", text: "select secret_marker_y from public.apps where id = $1" }),
      { ...known, calls: 900, rows: 900 },
      e({ queryid: "53", text: "select secret_marker_w, * from public.users" }),
      e({ queryid: "54", text: "select secret_marker_v from public.users where id = $1" }),
      e({ role: 'evil"; drop', queryid: "55", text: "select secret_marker_u from public.apps where id = $1" }),
    ];
    const all = texts(judge({ latest: leaky, previous: [known], baseline: captured([base]) })).join("\n");
    assert.doesNotMatch(all, /secret_marker/);
    assert.match(all, /evil\?\?\?drop@testermatch/);
  });
});

describe("buildBaseline", () => {
  const snapshot = snap(AT, [
    e({ queryid: "1", calls: 103, rows: 103 }),
    e({ queryid: "2", text: "select * from public.users" }),
    e({ role: "tmadmin", queryid: "3", text: "select id from public.apps where id = $1" }),
  ]);

  it("records each shape's daily rate, leaves rule hits out unless allowed and keeps the capture date", () => {
    const { baseline, added, flagged } = buildBaseline({ snapshot, existing: collecting, publicTables: PUBLIC, capturedAt: "2026-11-03T01:00:00Z" });
    assert.deepEqual(added.map((x) => x.queryid), ["1", "3"]);
    assert.deepEqual(flagged.map((x) => [x.queryid, x.reason]), [["2", "개인정보 테이블 전체 조회"]]);
    assert.equal(baseline.captureOn, "2026-11-03");
    assert.equal(baseline.snapshotAt, AT);
    assert.deepEqual(baseline.entries[0], {
      role: "service_role", db: "testermatch", queryid: "1", verb: "SELECT", tables: ["public.apps"], callsPerDay: 10, rowsPerDay: 10,
    });
    assert.ok(baseline.entries.every((x) => !("text" in x)));
    const allowed = buildBaseline({ snapshot, existing: collecting, publicTables: PUBLIC, allow: ["2"], capturedAt: "t" });
    assert.equal(allowed.baseline.entries.length, 3);
  });

  it("merges into an existing baseline without duplicates", () => {
    const existing = captured([{ role: "tmadmin", db: "testermatch", queryid: "3", verb: "SELECT", tables: ["public.apps"], callsPerDay: 1, rowsPerDay: 1 }]);
    const { baseline, added } = buildBaseline({ snapshot, existing, publicTables: PUBLIC, merge: true, capturedAt: "t" });
    assert.deepEqual(added.map((x) => x.queryid), ["1"]);
    assert.deepEqual(baseline.entries.map((x) => x.queryid), ["1", "3"]);
  });
});
