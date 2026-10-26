/**
 * Judging rules for ⑥ unfamiliar database queries. Pure (no network, no child processes) so they
 * can be unit tested; check.mjs fetches the snapshots and pg-baseline.mjs captures the baseline.
 *
 * The cron Function App logs a pg_stat_statements snapshot to App Insights at 06:30 KST
 * (03-output/infra/azure/cron-functions/src/pgss-snapshot.js). The statistics are cumulative, so a
 * query shape is judged by what it did since the previous snapshot: an old event is reported on the
 * day it happened, not every day after.
 *
 * PostgREST wraps every result in json_agg, so its shapes always show one row per call. Volume on
 * that path is measured in calls; rows per call only means something for direct SQL.
 *
 * Item text names role, database, statement verb, tables and queryid, never the SQL itself, because
 * Actions logs of this public repository are public. Look a queryid up with psql when needed.
 */

export const TRACE_PREFIX = "secwatch-pgss ";
export const SNAPSHOT_FUNCTION = "secwatch-pg-snapshot";
const GOTRUE_ROLE = "supabase_auth_admin";
const POSTGREST_ROLES = new Set(["anon", "authenticated", "service_role", "authenticator"]);
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const FRESH_HOURS = 26; // manual runs later in the day still read the 06:30 snapshot
const PREVIOUS_MIN_HOURS = 12;
const BIG_READ_ROWS = 1_000; // PostgREST returns at most 1,000 rows per request
const PII_ROWS_PER_CALL = 50; // direct SQL only; PostgREST always shows 1
const VOLUME_FACTOR = 5;
const VOLUME_MIN_CALLS = 100; // per day
const VOLUME_MIN_ROWS = 1_000; // per day
const REBASELINE_SHARE = 0.5;
const REBASELINE_MIN_ACTIVE = 10;

/** Tables holding emails, nicknames, contacts, payment details, IPs or auth tokens. */
export const PII_TABLES = new Set([
  "public.users",
  "public.waitlist_signups",
  "public.payments",
  "public.paid_tester_orders",
  "public.inquiries",
  "public.signup_attempts",
  "public.credit_redemptions",
  "public.audit_logs",
  "auth.users",
  "auth.identities",
  "auth.sessions",
  "auth.refresh_tokens",
  "auth.audit_log_entries",
  "auth.flow_state",
  "auth.one_time_tokens",
  "auth.mfa_factors",
]);

/** GoTrue's tables. GoTrue runs with search_path=auth and leaves them unqualified. */
const GOTRUE_TABLES = new Set([
  "audit_log_entries", "custom_oauth_providers", "flow_state", "identities", "instances", "mfa_amr_claims",
  "mfa_challenges", "mfa_factors", "mfa_recovery_code_sets", "mfa_recovery_codes", "oauth_authorizations",
  "oauth_client_states", "oauth_clients", "oauth_consents", "one_time_tokens", "refresh_tokens", "saml_providers",
  "saml_relay_states", "schema_migrations", "scim_tokens", "scim_users", "sessions", "sso_domains", "sso_providers",
  "users", "webauthn_challenges", "webauthn_credentials",
]);

export const keyOf = (e) => `${e.role}|${e.db}|${e.queryid}`;
const safe = (s) => String(s ?? "").replace(/[^\w.$-]/g, "?").slice(0, 63);

/** Public table names from the migration files (`create table [public.]name`). */
export function publicTablesFrom(sqlTexts) {
  const names = new Set();
  for (const sql of sqlTexts) {
    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\s*\.\s*)?"?([a-z_]\w*)"?(?![\w.])/gi)) {
      names.add(m[1].toLowerCase());
    }
  }
  return names;
}

/** App Insights trace rows ({ message }) → snapshots, newest first. Parts of one run share `at`. */
export function parseSnapshots(traces) {
  const runs = new Map();
  for (const t of traces) {
    const msg = String(t.message ?? "");
    if (!msg.startsWith(TRACE_PREFIX)) continue;
    let d;
    try {
      d = JSON.parse(msg.slice(TRACE_PREFIX.length));
    } catch {
      continue;
    }
    if (d?.v !== 1 || typeof d.at !== "string" || Number.isNaN(Date.parse(d.at))) continue;
    const run = runs.get(d.at) ?? { at: d.at, info: d.info ?? {}, error: null, parts: Number(d.parts) || 1, got: new Map() };
    if (d.error) run.error = String(d.error);
    run.got.set(Number(d.part), Array.isArray(d.rows) ? d.rows.filter((r) => Array.isArray(r) && r.length >= 7) : []);
    runs.set(d.at, run);
  }
  return [...runs.values()]
    .map((r) => ({
      at: r.at,
      info: r.info,
      error: r.error,
      parts: r.parts,
      received: r.got.size,
      complete: !r.error && r.got.size === r.parts,
      entries: [...r.got.entries()]
        .sort((a, b) => a[0] - b[0])
        .flatMap(([, rows]) => rows)
        .map(([role, db, queryid, calls, rows, since, text]) => ({
          role: String(role), db: String(db), queryid: String(queryid), calls: Number(calls) || 0, rows: Number(rows) || 0, since, text: String(text ?? ""),
        })),
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ---- classification -----------------------------------------------------------------------------

const IDENT = String.raw`(?:"(?:[^"]|"")+"|[a-z_][\w$]*)`;
const NAME = String.raw`${IDENT}(?:\s*\.\s*${IDENT}){0,2}`;
const ITEM_RE = new RegExp(String.raw`(?:only\s+|lateral\s+)?(${NAME})(\s*\*)?`, "iy");
const ALIAS_RE = new RegExp(String.raw`\s*(?:as\s+)?(${IDENT})`, "iy");
const NOT_ALIAS = new Set([
  "where", "join", "inner", "left", "right", "full", "cross", "natural", "on", "using", "group", "order", "limit",
  "offset", "having", "window", "union", "intersect", "except", "for", "returning", "set", "values", "tablesample",
  "fetch", "to", "from", "with",
]);
const FROM_KEYWORD = /(?<!\bdelete\s+)\b(?:from|join|using)\b/gi;
const TARGET_RE = new RegExp(String.raw`\b(?:insert\s+into|merge\s+into|delete\s+from|update(?:\s+only)?|truncate(?:\s+table)?(?:\s+only)?|into)\s+(${NAME})`, "gi");
const WRITE_VERB = /\b(insert)\s+into\b|\b(delete)\s+from\b|\b(merge)\s+into\b|(?<!\bfor\s+(?:no\s+key\s+)?)\b(update)\s+(?!skip\b|nowait\b|of\b|set\b)/i;
const TRIVIAL_WHERE = /^where\s+(?:true|\$\d+|1\s*=\s*1|\$\d+\s*=\s*\$\d+|not\s+false|[\w."]+\s+is\s+not\s+null)\s*(?:$|[);]|(?:order|group|limit|offset|having|window|for|union|intersect|except|returning|fetch)\b)/i;
const PRIVILEGE = /^(?:(?:create|alter|drop)\s+(?:role|user|group)\b|grant\b|revoke\b|alter\s+default\s+privileges\b|set\s+(?:session\s+|local\s+)?(?:role|session\s+authorization)\b)/i;
const COUNT_ONLY = /^select\s+(?:pg_catalog\.)?count\s*\(\s*(?:\*|[\w."]+)\s*\)(?:\s+as\s+[\w"]+)?\s+from\s/i;

function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function skipSpace(sql, i) {
  while (i < sql.length && /\s/.test(sql[i])) i++;
  return i;
}

function skipParens(sql, i) {
  let depth = 0;
  for (; i < sql.length; i++) {
    if (sql[i] === "(") depth++;
    else if (sql[i] === ")" && --depth === 0) return i + 1;
  }
  return sql.length;
}

/** Names in a FROM / JOIN / USING list: "a", "a x", "a AS x", "(subquery) x", "f(...)", comma-separated. */
function fromList(sql, start) {
  const names = [];
  let i = start;
  for (let guard = 0; guard < 64; guard++) {
    i = skipSpace(sql, i);
    if (sql[i] === "(") {
      i = skipParens(sql, i);
    } else {
      ITEM_RE.lastIndex = i;
      const m = ITEM_RE.exec(sql);
      if (!m) break;
      i = ITEM_RE.lastIndex;
      const after = skipSpace(sql, i);
      if (sql[after] === "(") i = skipParens(sql, after); // a function call such as unnest(...)
      else names.push(m[1]);
    }
    ALIAS_RE.lastIndex = i;
    const a = ALIAS_RE.exec(sql);
    if (a && !NOT_ALIAS.has(a[1].replace(/"/g, "").toLowerCase())) {
      i = ALIAS_RE.lastIndex;
      const after = skipSpace(sql, i);
      if (sql[after] === "(") i = skipParens(sql, after); // column alias list
    }
    i = skipSpace(sql, i);
    if (sql[i] !== ",") break;
    i += 1;
  }
  return { names, end: i };
}

/** Does a non-trivial WHERE follow at the same nesting level, before the clause ends? */
function clauseFiltered(sql, from) {
  let depth = 0;
  const re = /[()]|\b(?:where|union|intersect|except)\b/gi;
  re.lastIndex = from;
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    if (m[0] === "(") depth++;
    else if (m[0] === ")") {
      if (--depth < 0) return false;
    } else if (depth === 0) {
      if (m[0].toLowerCase() !== "where") return false;
      if (!TRIVIAL_WHERE.test(sql.slice(m.index))) return true;
    }
  }
  return false;
}

function resolveTable(raw, role, publicTables) {
  const parts = raw.split(/\s*\.\s*/).map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"').toLowerCase());
  if (parts.length >= 2) return parts.slice(-2).join(".");
  const [name] = parts;
  if (role === GOTRUE_ROLE) {
    // Under search_path=auth a public-only name resolves only after search_path changed.
    if (GOTRUE_TABLES.has(name)) return `auth.${name}`;
    return publicTables.has(name) ? `public.${name}` : null;
  }
  // Unknown unqualified names are CTEs, columns after EXTRACT(… FROM x) and the like.
  return publicTables.has(name) ? `public.${name}` : null;
}

function copyInfo(sql) {
  if (!/^copy\b/i.test(sql)) return null;
  let i = skipSpace(sql, 4);
  let name = null;
  if (sql[i] === "(") {
    i = skipParens(sql, i);
  } else {
    ITEM_RE.lastIndex = i;
    const m = ITEM_RE.exec(sql);
    if (m) {
      name = m[1];
      i = skipSpace(sql, ITEM_RE.lastIndex);
      if (sql[i] === "(") i = skipParens(sql, i);
    }
  }
  const d = /\s*(to|from)\s+(stdout|stdin|program|'|[\w$]+)/iy;
  d.lastIndex = i;
  const m = d.exec(sql);
  if (!m) return { dir: "to", server: true, name }; // unrecognised form: assume the worst
  const target = m[2].toLowerCase();
  return { dir: m[1].toLowerCase(), server: target !== "stdout" && target !== "stdin", name };
}

/** Verb, source and target tables and the features the rules look at, from normalized SQL text. */
export function classifyQuery(text, { role, publicTables = new Set() } = {}) {
  const sql = stripComments(String(text ?? "")).trim();
  const first = (sql.match(/^[a-z]+/i)?.[0] ?? "?").toUpperCase();
  let verb = first;
  if (first === "WITH") {
    const w = sql.match(WRITE_VERB);
    verb = w ? (w[1] ?? w[2] ?? w[3] ?? w[4]).toUpperCase() : "SELECT";
  }
  const resolve = (raw) => resolveTable(raw, role, publicTables);
  const sources = new Map(); // table → filtered?
  const addSource = (raw, filtered) => {
    const t = resolve(raw);
    if (t) sources.set(t, (sources.get(t) ?? true) && filtered);
  };
  for (const m of sql.matchAll(FROM_KEYWORD)) {
    const { names, end } = fromList(sql, m.index + m[0].length);
    const filtered = clauseFiltered(sql, end);
    for (const n of names) addSource(n, filtered);
  }
  const tableStmt = sql.match(new RegExp(String.raw`^table\s+(?:only\s+)?(${NAME})`, "i"));
  if (tableStmt) addSource(tableStmt[1], false);

  const copy = copyInfo(sql);
  const targets = new Set();
  for (const m of sql.matchAll(TARGET_RE)) {
    const t = resolve(m[1]);
    if (t) targets.add(t);
  }
  if (copy?.name) {
    if (copy.dir === "to") addSource(copy.name, false);
    else {
      const t = resolve(copy.name);
      if (t) targets.add(t);
    }
  }
  const tables = [...new Set([...sources.keys(), ...targets])];
  const piiUnfiltered = [...sources].filter(([t, filtered]) => PII_TABLES.has(t) && !filtered).map(([t]) => t);
  return {
    verb,
    tables,
    sources: [...sources.keys()],
    targets: [...targets],
    piiSources: [...sources.keys()].filter((t) => PII_TABLES.has(t)),
    piiUnfiltered: COUNT_ONLY.test(sql) ? [] : piiUnfiltered,
    copy: copy?.dir ?? null,
    serverCopy: Boolean(copy?.server),
    touchesPublic: tables.some((t) => t.startsWith("public.")),
    setsSearchPath: /^set\s+(?:session\s+|local\s+)?search_path\b/i.test(sql) || /\bset_config\s*\(\s*'search_path'/i.test(sql),
    privilege: PRIVILEGE.test(sql),
  };
}

// ---- rules --------------------------------------------------------------------------------------

/** Rule hits that hold whether or not the shape is in the baseline: [status, reason]. */
function alwaysRule(entry, c) {
  if (c.serverCopy) return ["danger", "서버 파일·명령 COPY"];
  if (c.copy === "to") return ["danger", "COPY 내보내기"];
  if (entry.role === GOTRUE_ROLE && c.setsSearchPath) return ["danger", "GoTrue 역할이 search_path 변경"];
  if (entry.role === GOTRUE_ROLE && c.touchesPublic) return ["danger", "GoTrue 역할이 public 스키마 접근"];
  if (c.privilege && POSTGREST_ROLES.has(entry.role)) return ["danger", "PostgREST 역할의 권한 변경"];
  if (c.privilege) return ["warn", "권한·역할 변경 — 본인 작업(GoTrue 업그레이드 포함)인지 확인"];
  if (c.copy === "from") return ["warn", "COPY 가져오기"];
  return null;
}

/** Reads that only a shape outside the baseline gets flagged for. */
function bulkReason(entry, c) {
  if (c.piiUnfiltered.length) return "개인정보 테이블 전체 조회";
  if (entry.calls > 0 && c.piiSources.length && entry.rows / entry.calls >= PII_ROWS_PER_CALL) {
    return `개인정보 한 번에 ${Math.round(entry.rows / entry.calls).toLocaleString("en-US")}행 조회`;
  }
  if (entry.calls > 0 && c.sources.length && entry.rows / entry.calls >= BIG_READ_ROWS) {
    return `한 번에 ${Math.round(entry.rows / entry.calls).toLocaleString("en-US")}행 조회`;
  }
  return null;
}

/** A baselined shape reading personal data far above its usual daily rate. */
function volumeReason(a, base, windowDays) {
  if (!a.c.piiSources.length || base?.callsPerDay == null || !(windowDays > 0)) return null;
  const calls = a.calls / windowDays;
  const rows = a.rows / windowDays;
  const callLimit = Math.max(VOLUME_FACTOR * base.callsPerDay, VOLUME_MIN_CALLS);
  const rowLimit = Math.max(VOLUME_FACTOR * (base.rowsPerDay ?? 0), VOLUME_MIN_ROWS);
  if (calls <= callLimit && rows <= rowLimit) return null;
  const n = (v) => Math.round(v).toLocaleString("en-US");
  return `개인정보 조회가 평소보다 많음 — 하루 ${n(calls)}회 ${n(rows)}행 (평소 ${n(base.callsPerDay)}회 ${n(base.rowsPerDay ?? 0)}행)`;
}

function describe(a) {
  const n = (v) => Math.round(v).toLocaleString("en-US");
  const tables = a.c.tables.slice(0, 3).map(safe).join(", ") || "-";
  return `${safe(a.role)}@${safe(a.db)} ${safe(a.c.verb)} ${tables} · ${n(a.calls)}회 ${n(a.rows)}행 · queryid ${safe(a.queryid)}`;
}

function kstDate(now) {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** Shapes whose calls grew since `previous`; without one, shapes first seen in the last FRESH_HOURS. */
function activeEntries(latest, previous, publicTables) {
  const before = new Map((previous?.entries ?? []).map((e) => [keyOf(e), e]));
  const cutoff = Date.parse(latest.at) - FRESH_HOURS * HOUR_MS;
  const out = [];
  for (const e of latest.entries) {
    const p = before.get(keyOf(e));
    const same = p && p.since === e.since;
    const calls = same ? e.calls - p.calls : e.calls;
    const rows = same ? e.rows - p.rows : e.rows;
    const active = previous ? calls > 0 : Date.parse(e.since) >= cutoff;
    if (active) out.push({ ...e, calls, rows, c: classifyQuery(e.text, { role: e.role, publicTables }) });
  }
  return out;
}

function snapshotHealth(latest, snapshots, previous) {
  const items = [];
  if (!latest.complete) items.push({ status: "unknown", text: `스냅샷 ${latest.parts}개 중 ${latest.received}개만 도착 — 받은 부분만 판정` });
  const { track, trackUtility, computeQueryId } = latest.info;
  if ((track && !["top", "all"].includes(track)) || (trackUtility && trackUtility !== "on") || computeQueryId === "off") {
    items.push({ status: "warn", text: `쿼리 통계 수집이 꺼짐 (track=${safe(track)}, track_utility=${safe(trackUtility)}, compute_query_id=${safe(computeQueryId)})` });
  }
  if (!latest.entries.length) items.push({ status: "warn", text: "스냅샷이 비어 있음 — 통계 수집이 꺼졌거나 막 초기화됨" });
  const sameDay = snapshots.filter((s) => s !== latest && Date.parse(latest.at) - Date.parse(s.at) < 20 * HOUR_MS && s.at < latest.at);
  if (sameDay.length) items.push({ status: "warn", text: `하루 사이 스냅샷 ${sameDay.length + 1}개 — 직접 실행한 게 아니면 위조 의심` });
  if (previous) {
    if (latest.info.statsReset && latest.info.statsReset !== previous.info.statsReset) {
      items.push({ status: "warn", text: `pg_stat_statements 통계 초기화됨 (${safe(latest.info.statsReset)}) — 본인 작업이 아니면 흔적 지우기 의심` });
    }
    const evicted = (latest.info.dealloc ?? 0) - (previous.info.dealloc ?? 0);
    if (evicted > 0) items.push({ status: "warn", text: `드물게 쓰인 쿼리 형태 ${evicted}개가 기록에서 밀려남 (pg_stat_statements.max) — 놓친 형태가 있을 수 있음` });
  } else {
    items.push({ status: "ok", text: `비교할 전날 스냅샷 없음 — 최근 ${FRESH_HOURS}시간 사이 처음 나온 형태만 판정` });
  }
  return items;
}

export function judgeDbQueries({ snapshots, baseline, publicTables = new Set(), now = new Date(), maxAgeHours = FRESH_HOURS }) {
  const newest = snapshots[0];
  if (!newest) return [{ status: "unknown", text: `DB 쿼리 스냅샷 없음 — 함수 ${SNAPSHOT_FUNCTION} 실행·SECWATCH_PG_ENABLED 확인` }];
  const ageHours = (now.getTime() - Date.parse(newest.at)) / HOUR_MS;
  if (ageHours > maxAgeHours) {
    return [{ status: "unknown", text: `가장 최근 DB 쿼리 스냅샷이 ${Math.round(ageHours)}시간 전 — 오늘 06:30 함수 실행 확인` }];
  }
  if (newest.error) return [{ status: "unknown", text: `DB 쿼리 스냅샷 실패: ${newest.error}` }];

  const latest = newest;
  const previous = snapshots.find((s) => s.complete && Date.parse(latest.at) - Date.parse(s.at) >= PREVIOUS_MIN_HOURS * HOUR_MS);
  const windowDays = previous ? (Date.parse(latest.at) - Date.parse(previous.at)) / DAY_MS : 0;
  const items = snapshotHealth(latest, snapshots, previous);

  const captured = Boolean(baseline?.capturedAt);
  const known = new Map((baseline?.entries ?? []).map((e) => [keyOf(e), e]));
  const active = activeEntries(latest, previous, publicTables);
  const unseen = [];
  for (const a of active) {
    const always = alwaysRule(a, a.c);
    if (always) {
      items.push({ status: always[0], text: `${always[1]} — ${describe(a)}` });
      continue;
    }
    const base = known.get(keyOf(a));
    if (base) {
      const volume = volumeReason(a, base, windowDays);
      if (volume) items.push({ status: "danger", text: `${volume} — ${describe(a)}` });
      continue;
    }
    const bulk = bulkReason(a, a.c);
    if (bulk) {
      items.push(
        captured
          ? { status: "danger", text: `${bulk} (기준선에 없는 형태) — ${describe(a)}` }
          : { status: "warn", text: `${bulk} (기준선 전 — 정상 기능인지 확인) — ${describe(a)}` },
      );
      continue;
    }
    if (captured) unseen.push(a);
  }

  if (unseen.length && active.length >= REBASELINE_MIN_ACTIVE && unseen.length > active.length * REBASELINE_SHARE) {
    items.push({
      status: "warn",
      text: `24시간 동안 쓰인 형태 ${active.length}개 중 ${unseen.length}개가 기준선에 없음 — PostgreSQL 업그레이드·DB 재구축 직후면 기준선 재캡처, 아니면 공격 의심`,
    });
  } else {
    const groups = new Map();
    for (const a of unseen) {
      if (a.c.piiSources.length) {
        items.push({ status: "warn", text: `처음 보는 개인정보 테이블 쿼리 — ${describe(a)}` });
        continue;
      }
      const who = `${safe(a.role)}@${safe(a.db)}`;
      groups.set(who, [...(groups.get(who) ?? []), a]);
    }
    for (const [who, list] of groups) {
      const shown = list.slice(0, 3).map((a) => `${safe(a.c.verb)} ${safe(a.c.tables[0] ?? "-")} (queryid ${safe(a.queryid)})`);
      items.push({ status: "warn", text: `처음 보는 쿼리 형태 ${list.length}개 — ${who}: ${shown.join(", ")}${list.length > 3 ? " …" : ""}` });
    }
  }

  if (!captured) {
    const due = baseline?.captureOn;
    if (due && kstDate(now) >= due) {
      items.push({ status: "warn", text: `기준선 캡처 기한(${safe(due)}) 지남 — pg-baseline.mjs 로 캡처해 PR` });
    } else {
      items.push({ status: "ok", text: `기준선 수집 중 — 형태 ${latest.entries.length}개, ${safe(due ?? "날짜 미정")} 캡처 예정 (그 전에는 새 형태 알림 없음)` });
    }
  }
  if (!items.some((i) => i.status !== "ok")) {
    items.push({
      status: "ok",
      text: `${Math.round(ageHours * 60)}분 전 스냅샷 · 형태 ${latest.entries.length}개 중 24시간 활동 ${active.length}개${captured ? " 모두 기준선 안" : ""} · 위험 규칙 해당 없음`,
    });
  }
  return items;
}

/** Baseline from a snapshot, with each shape's usual daily rate. Rule hits stay out unless allowed. */
export function buildBaseline({ snapshot, existing, publicTables = new Set(), merge = false, allow = [], capturedAt }) {
  const allowed = new Set(allow.map(String));
  const kept = merge ? (existing?.entries ?? []) : [];
  const seen = new Set(kept.map(keyOf));
  const added = [];
  const flagged = [];
  const round1 = (v) => Math.round(v * 10) / 10;
  for (const e of snapshot.entries) {
    if (seen.has(keyOf(e))) continue;
    const c = classifyQuery(e.text, { role: e.role, publicTables });
    const days = Math.max(1, (Date.parse(snapshot.at) - Date.parse(e.since)) / DAY_MS || 1);
    const entry = {
      role: e.role, db: e.db, queryid: e.queryid, verb: c.verb, tables: c.tables,
      callsPerDay: round1(e.calls / days), rowsPerDay: round1(e.rows / days),
    };
    const reason = alwaysRule(e, c)?.[1] ?? bulkReason(e, c);
    if (reason && !allowed.has(e.queryid)) {
      flagged.push({ ...entry, reason });
      continue;
    }
    seen.add(keyOf(e));
    added.push(entry);
  }
  const entries = [...kept, ...added].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  return {
    baseline: { captureOn: existing?.captureOn ?? null, capturedAt, snapshotAt: snapshot.at, entries },
    added,
    flagged,
  };
}
