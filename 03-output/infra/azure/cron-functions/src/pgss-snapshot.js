/**
 * 보안 점검 ⑥ 낯선 DB 쿼리 — pg_stat_statements 스냅샷을 App Insights traces 로 남긴다.
 * 판정은 하지 않는다: GitHub 의 보안 점검(05-harness/security-watch/pg-queries.mjs)이 읽고 판정하므로
 * 규칙을 바꿔도 이 함수는 다시 배포하지 않는다.
 *
 * pg_stat_statements 는 대부분의 상수를 $n 으로 바꾸지만 일부 유틸리티 명령은 리터럴을 그대로 둔다 —
 * 문자열·달러 인용 본문은 DB 밖으로 나가기 전에 지운다. azuresu(Azure 제어 평면, 고객 로그인 불가)는 개수만 센다.
 */

export const TRACE_PREFIX = "secwatch-pgss ";
export const SNAPSHOT_VERSION = 1;
const MAX_QUERY_CHARS = 2_000;
const MAX_MESSAGE_CHARS = 12_000; // App Insights trace 메시지 한도 32,768자 안쪽
const IGNORED_ROLES = new Set(["azuresu"]);

export const INFO_SQL = `select dealloc::text as dealloc, stats_reset, current_setting('server_version') as server_version
  from pg_stat_statements_info`;

// 자기 자신(secwatch_reader)의 조회는 뺀다. bigint 는 문자열로 받는다 (queryid 는 2^53 을 넘는다).
export const ENTRIES_SQL = `select coalesce(r.rolname, s.userid::text) as role,
       coalesce(d.datname, s.dbid::text) as db,
       s.queryid::text as queryid, s.calls::text as calls, s.rows::text as rows,
       s.stats_since, s.query
  from pg_stat_statements s
  left join pg_roles r on r.oid = s.userid
  left join pg_database d on d.oid = s.dbid
 where s.toplevel and s.userid <> (select oid from pg_roles where rolname = current_user)`;

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 문자열 리터럴·달러 인용 본문을 지우고 공백을 줄인 뒤 MAX_QUERY_CHARS 로 자른다 */
export function scrubQuery(text) {
  const out = String(text ?? "")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, () => "$$…$$")
    .replace(/'(?:[^']|'')*'/g, () => "'…'")
    .replace(/\s+/g, " ")
    .trim();
  return out.length > MAX_QUERY_CHARS ? `${out.slice(0, MAX_QUERY_CHARS)}…` : out;
}

/** 오류 문구의 IP 주소를 가린다 — 이 문구는 공개 저장소의 Actions 로그까지 간다 */
export function scrubError(message) {
  return String(message ?? "")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "x.x.x.x")
    .slice(0, 300);
}

/** 한 번의 스냅샷 → trace 메시지 목록. 각 메시지는 `secwatch-pgss {json}` 이고 part/parts 로 다시 맞춘다 */
export function snapshotMessages({ at, info, entries, maxChars = MAX_MESSAGE_CHARS }) {
  const ignored = {};
  const rows = [];
  for (const e of entries) {
    if (IGNORED_ROLES.has(e.role)) {
      ignored[e.role] = (ignored[e.role] ?? 0) + 1;
      continue;
    }
    rows.push([e.role, e.db, String(e.queryid), Number(e.calls), Number(e.rows), iso(e.stats_since), scrubQuery(e.query)]);
  }
  const parts = [[]];
  let size = 0;
  for (const row of rows) {
    const len = JSON.stringify(row).length + 1;
    if (parts.at(-1).length && size + len > maxChars) {
      parts.push([]);
      size = 0;
    }
    parts.at(-1).push(row);
    size += len;
  }
  const head = { v: SNAPSHOT_VERSION, at, info: { ...info, ignored } };
  return parts.map((part, i) => TRACE_PREFIX + JSON.stringify({ ...head, part: i + 1, parts: parts.length, rows: part }));
}

export function errorMessage({ at, error }) {
  return TRACE_PREFIX + JSON.stringify({ v: SNAPSHOT_VERSION, at, part: 1, parts: 1, error: scrubError(error) });
}

/** client 는 pg.Client 처럼 query(sql) → { rows } 를 돌려주면 된다 (테스트는 가짜 객체) */
export async function takeSnapshot(client, at = new Date().toISOString()) {
  const [info] = (await client.query(INFO_SQL)).rows;
  const { rows } = await client.query(ENTRIES_SQL);
  return snapshotMessages({
    at,
    info: { dealloc: Number(info?.dealloc ?? 0), statsReset: iso(info?.stats_reset), serverVersion: info?.server_version ?? null },
    entries: rows,
  });
}
