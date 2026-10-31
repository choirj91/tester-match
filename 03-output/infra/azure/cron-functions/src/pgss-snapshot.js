/**
 * 보안 점검 ⑥ 낯선 DB 쿼리 — pg_stat_statements 스냅샷을 App Insights traces 로 남긴다.
 * 판정은 하지 않는다: GitHub 의 보안 점검(05-harness/security-watch/pg-queries.mjs)이 읽고 판정하므로
 * 규칙을 바꿔도 이 함수는 다시 배포하지 않는다.
 *
 * pg_stat_statements 는 대부분의 상수를 $n 으로 바꾸지만 일부 유틸리티 명령은 리터럴을 그대로 둔다 —
 * 문자열·달러 인용 본문·주석은 DB 밖으로 나가기 전에 지운다. azuresu(Azure 제어 평면, 고객 로그인 불가)는 개수만 센다.
 */

export const TRACE_PREFIX = "secwatch-pgss ";
export const SNAPSHOT_VERSION = 1;
const MAX_SCAN_CHARS = 20_000; // SQL 에서도 같은 길이로 자른다 — 아주 긴 원문을 읽지 않는다
const MAX_QUERY_CHARS = 6_000; // PostgREST 의 긴 select 목록 뒤 FROM 까지 담는다
const MAX_MESSAGE_CHARS = 12_000; // App Insights trace 메시지 한도 32,768자 안쪽
const IGNORED_ROLES = new Set(["azuresu"]);
// 설정 이름은 남긴다 — set_config('search_path', …) 를 판정해야 한다. 값은 $n 이라 남지 않는다
const KEPT_LITERALS = new Set(["search_path", "role"]);

export const INFO_SQL = `select i.dealloc::text as dealloc, i.stats_reset,
       current_setting('server_version') as server_version,
       current_setting('pg_stat_statements.track') as track,
       current_setting('pg_stat_statements.track_utility') as track_utility,
       current_setting('compute_query_id') as compute_query_id
  from pg_stat_statements_info i`;

// 이 함수의 역할(secwatch_reader)도 남긴다 — 비밀번호가 새면 그 조회도 보여야 한다.
// bigint 는 문자열로 받는다 (queryid 는 2^53 을 넘는다).
export const ENTRIES_SQL = `select coalesce(r.rolname, s.userid::text) as role,
       coalesce(d.datname, s.dbid::text) as db,
       s.queryid::text as queryid, s.calls::text as calls, s.rows::text as rows,
       s.stats_since, left(s.query, ${MAX_SCAN_CHARS}) as query
  from pg_stat_statements s
  left join pg_roles r on r.oid = s.userid
  left join pg_database d on d.oid = s.dbid
 where s.toplevel`;

function iso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const DOLLAR_TAG = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/;

/** 문자열 리터럴(E'' 포함)·달러 인용 본문·주석을 지운다. 따옴표 안의 -- 나 ' 에 속지 않도록 한 번에 훑는다 */
export function scrubQuery(text) {
  const s = String(text ?? "").slice(0, MAX_SCAN_CHARS);
  let out = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "-" && s[i + 1] === "-") {
      const end = s.indexOf("\n", i);
      i = end < 0 ? s.length : end;
      out += " ";
    } else if (c === "/" && s[i + 1] === "*") {
      const end = s.indexOf("*/", i + 2);
      i = end < 0 ? s.length : end + 2;
      out += " ";
    } else if (c === '"') {
      let j = i + 1;
      while (j < s.length && !(s[j] === '"' && s[j + 1] !== '"')) j += s[j] === '"' ? 2 : 1;
      out += s.slice(i, j + 1);
      i = j + 1;
    } else if (c === "$" && !/[\w$]/.test(s[i - 1] ?? "") && DOLLAR_TAG.test(s.slice(i, i + 66))) {
      const tag = DOLLAR_TAG.exec(s.slice(i, i + 66))[0];
      const end = s.indexOf(tag, i + tag.length);
      i = end < 0 ? s.length : end + tag.length;
      out += "$$…$$";
    } else if (c === "'") {
      const escapes = /[Ee]/.test(s[i - 1] ?? "") && !/[\w$]/.test(s[i - 2] ?? "");
      let j = i + 1;
      while (j < s.length) {
        if (escapes && s[j] === "\\") j += 2;
        else if (s[j] === "'" && s[j + 1] === "'") j += 2;
        else if (s[j] === "'") break;
        else j += 1;
      }
      const body = s.slice(i + 1, j);
      out += KEPT_LITERALS.has(body.toLowerCase()) ? `'${body}'` : "'…'";
      i = j + 1;
    } else {
      out += c;
      i += 1;
    }
  }
  const flat = out.replace(/\s+/g, " ").trim();
  return flat.length > MAX_QUERY_CHARS ? `${flat.slice(0, MAX_QUERY_CHARS)}…` : flat;
}

/** 오류 문구의 IP 주소를 가린다 — 이 문구는 공개 저장소의 Actions 로그까지 간다 */
export function scrubError(message) {
  return String(message ?? "")
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, "x.x.x.x")
    .replace(/\b[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}\b/gi, "x:x::x")
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
    info: {
      dealloc: Number(info?.dealloc ?? 0),
      statsReset: iso(info?.stats_reset),
      serverVersion: info?.server_version ?? null,
      track: info?.track ?? null,
      trackUtility: info?.track_utility ?? null,
      computeQueryId: info?.compute_query_id ?? null,
    },
    entries: rows,
  });
}

/**
 * 타이머 본체. Client 는 pg.Client 생성자(테스트는 가짜), env 는 앱 설정.
 * pg 는 끊긴 연결을 'error' 이벤트로도 내보낸다 — 듣지 않으면 같은 워커의 다른 타이머까지 함께 죽는다.
 * 실패하면 오류 trace 를 남기고 다시 던진다 (Functions 실행 실패로도 남도록).
 */
export async function runSnapshot({ env, Client, log, now = () => new Date() }) {
  if (env.SECWATCH_PG_ENABLED !== "1") {
    log("secwatch-pg-snapshot: skipped (SECWATCH_PG_ENABLED is not 1)");
    return false;
  }
  const at = now().toISOString();
  const client = new Client({
    host: env.SECWATCH_PG_HOST,
    user: env.SECWATCH_PG_USER,
    password: env.SECWATCH_PG_PASSWORD,
    database: "postgres",
    ssl: true,
    application_name: "secwatch-pg-snapshot",
    connectionTimeoutMillis: 15_000,
    statement_timeout: 15_000,
    query_timeout: 30_000,
    options: "-c default_transaction_read_only=on",
  });
  client.on("error", (err) => log(`secwatch-pg-snapshot: connection error ${scrubError(err?.message ?? err)}`));
  try {
    await client.connect();
    for (const message of await takeSnapshot(client, at)) log(message);
    return true;
  } catch (err) {
    log(errorMessage({ at, error: err?.message ?? err }));
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}
