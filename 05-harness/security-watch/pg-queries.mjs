/**
 * Judging rules for ⑥ unfamiliar database queries. Pure (no network, no child processes) so they
 * can be unit tested; check.mjs fetches the snapshots and pg-baseline.mjs captures the baseline.
 *
 * The cron Function App logs a pg_stat_statements snapshot to App Insights at 06:30 KST
 * (03-output/infra/azure/cron-functions/src/pgss-snapshot.js). The statistics are cumulative, so a
 * query shape is judged only when its call count grew since the previous snapshot: an old event is
 * reported on the day it happened, not every day after.
 *
 * Item text names role, database, statement verb, tables and queryid, never the SQL itself, because
 * Actions logs of this public repository are public. Look a queryid up with psql when needed.
 */

export const TRACE_PREFIX = "secwatch-pgss ";
const GOTRUE_ROLE = "supabase_auth_admin";
const HOUR_MS = 3_600_000;
const FRESH_HOURS = 26; // one daily snapshot plus room for a late timer
const PREVIOUS_MIN_HOURS = 12;
const BIG_READ_ROWS = 1_000; // PostgREST returns at most 1,000 rows per request
const REBASELINE_SHARE = 0.5;
const REBASELINE_MIN_ACTIVE = 10;

/** Tables holding emails, nicknames, payment details, IPs or auth tokens. */
export const PII_TABLES = new Set([
  "public.users",
  "public.waitlist_signups",
  "public.payments",
  "public.paid_tester_orders",
  "public.inquiries",
  "public.signup_attempts",
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
    if (d?.v !== 1 || !d.at) continue;
    const run = runs.get(d.at) ?? { at: d.at, info: d.info ?? {}, error: null, parts: Number(d.parts) || 1, got: new Map() };
    if (d.error) run.error = String(d.error);
    run.got.set(d.part, d.rows ?? []);
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
          role, db, queryid: String(queryid), calls: Number(calls), rows: Number(rows), since, text: String(text ?? ""),
        })),
    }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const IDENT = String.raw`(?:"[^"]+"|[a-z_][\w$]*)`;
const NAME = String.raw`(${IDENT}(?:\s*\.\s*${IDENT})?)`;
// A name right before "(" after FROM is a function call (unnest, now); after INTO it is a column list.
const FROM_RE = new RegExp(String.raw`\b(?:from|join)\s+(?:only\s+|lateral\s+)?${NAME}(?![\w$"]|\s*[.(])`, "gi");
const TARGET_RE = new RegExp(String.raw`\b(?:into|update|copy|truncate|table)\s+(?:only\s+)?${NAME}(?![\w$"]|\s*\.)`, "gi");
const NOT_TABLES = new Set(["skip", "nowait", "of", "set", "only", "lateral", "select", "values", "stdin", "stdout"]);
// CTE names (PostgREST's pgrst_source) are read with FROM but are not tables.
const CTE_RE = new RegExp(String.raw`(?:\bwith\s+(?:recursive\s+)?|,\s*)(${IDENT})\s+as\s+(?:not\s+)?(?:materialized\s+)?\(`, "gi");
const LEADING_NOISE = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/;
const WRITE_VERB = /\b(insert)\s+into\b|\b(delete)\s+from\b|\b(merge)\s+into\b|(?<!\bfor\s+(?:no\s+key\s+)?)\b(update)\s+(?!skip\b|nowait\b|of\b|set\b)/i;

function resolveTable(raw, role, publicTables) {
  const parts = raw.split(/\s*\.\s*/).map((p) => p.replace(/^"|"$/g, "").toLowerCase());
  if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
  const [name] = parts;
  if (role !== GOTRUE_ROLE) return `public.${name}`;
  // Under search_path=auth an unqualified public-only name resolves only after search_path changed.
  return !GOTRUE_TABLES.has(name) && publicTables.has(name) ? `public.${name}` : `auth.${name}`;
}

/** Verb, tables and the features the rules look at, from normalized SQL text. */
export function classifyQuery(text, { role, publicTables = new Set() } = {}) {
  const sql = String(text ?? "").replace(LEADING_NOISE, "");
  const first = (sql.match(/^[a-z]+/i)?.[0] ?? "?").toUpperCase();
  let verb = first;
  if (first === "WITH") {
    const w = sql.match(WRITE_VERB);
    verb = w ? (w[1] ?? w[2] ?? w[3] ?? w[4]).toUpperCase() : "SELECT";
  }
  const ctes = new Set([...sql.matchAll(CTE_RE)].map((m) => m[1].replace(/"/g, "").toLowerCase()));
  const tables = new Set();
  for (const re of [FROM_RE, TARGET_RE]) {
    for (const m of sql.matchAll(re)) {
      const bare = m[1].replace(/"/g, "").toLowerCase();
      if (NOT_TABLES.has(bare) || ctes.has(bare)) continue;
      tables.add(resolveTable(m[1], role, publicTables));
    }
  }
  let copy = null;
  if (verb === "COPY") copy = /\bfrom\s+(?:stdin\b|'|program\b)/i.test(sql) && !/\bto\s+(?:stdout\b|'|program\b)/i.test(sql) ? "from" : "to";
  const list = [...tables];
  return {
    verb,
    tables: list,
    read: verb === "SELECT",
    hasWhere: /\bwhere\b/i.test(sql),
    copy,
    touchesPublic: list.some((t) => t.startsWith("public.")),
    setsSearchPath: /^set\s+(?:session\s+|local\s+)?search_path\b/i.test(sql),
  };
}

function bulkReadReason(entry, c) {
  if (!c.read) return null;
  if (!c.hasWhere && c.tables.some((t) => PII_TABLES.has(t))) return "개인정보 테이블 전체 조회";
  if (entry.calls > 0 && entry.rows / entry.calls >= BIG_READ_ROWS) return `한 번에 ${Math.round(entry.rows / entry.calls).toLocaleString("en-US")}행 조회`;
  return null;
}

/** Rule hits that hold regardless of the baseline. */
function alwaysReason(entry, c) {
  if (c.copy === "to") return "COPY 내보내기";
  if (entry.role === GOTRUE_ROLE && c.setsSearchPath) return "GoTrue 역할이 search_path 변경";
  if (entry.role === GOTRUE_ROLE && c.touchesPublic) return "GoTrue 역할이 public 스키마 접근";
  return null;
}

function describe(a) {
  const n = (v) => v.toLocaleString("en-US");
  return `${a.role}@${a.db} ${a.c.verb} ${a.c.tables.slice(0, 3).join(", ") || "-"} · ${n(a.calls)}회 ${n(a.rows)}행 · queryid ${a.queryid}`;
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

export function judgeDbQueries({ snapshots, baseline, publicTables = new Set(), now = new Date() }) {
  const nowMs = now.getTime();
  const latest = snapshots.find((s) => nowMs - Date.parse(s.at) <= FRESH_HOURS * HOUR_MS);
  if (!latest) {
    return [{ status: "unknown", text: `최근 ${FRESH_HOURS}시간 DB 쿼리 스냅샷 없음 — 함수 secwatch-pg-snapshot 실행·SECWATCH_PG_ENABLED 확인` }];
  }
  if (latest.error) return [{ status: "unknown", text: `DB 쿼리 스냅샷 실패: ${latest.error}` }];

  const items = [];
  if (!latest.complete) {
    items.push({ status: "unknown", text: `스냅샷 ${latest.parts}개 중 ${latest.received}개만 도착 — 받은 부분만 판정` });
  }
  const previous = snapshots.find((s) => s.complete && Date.parse(latest.at) - Date.parse(s.at) >= PREVIOUS_MIN_HOURS * HOUR_MS);
  if (previous) {
    if (latest.info.statsReset && latest.info.statsReset !== previous.info.statsReset) {
      items.push({ status: "warn", text: `pg_stat_statements 통계 초기화됨 (${latest.info.statsReset}) — 본인 작업이 아니면 흔적 지우기 의심` });
    }
    const evicted = (latest.info.dealloc ?? 0) - (previous.info.dealloc ?? 0);
    if (evicted > 0) items.push({ status: "warn", text: `드물게 쓰인 쿼리 형태 ${evicted}개가 기록에서 밀려남 (pg_stat_statements.max) — 놓친 형태가 있을 수 있음` });
  } else {
    items.push({ status: "ok", text: `비교할 전날 스냅샷 없음 — 최근 ${FRESH_HOURS}시간 사이 처음 나온 형태만 판정` });
  }

  const captured = Boolean(baseline?.capturedAt);
  const known = new Set((baseline?.entries ?? []).map(keyOf));
  const active = activeEntries(latest, previous, publicTables);
  const unseen = [];
  for (const a of active) {
    const always = alwaysReason(a, a.c);
    if (always) {
      items.push({ status: "danger", text: `${always} — ${describe(a)}` });
      continue;
    }
    if (a.c.copy === "from") {
      items.push({ status: "warn", text: `COPY 가져오기 — ${describe(a)}` });
      continue;
    }
    if (known.has(keyOf(a))) continue;
    const bulk = bulkReadReason(a, a.c);
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
    for (const a of unseen) groups.set(`${a.role}@${a.db}`, [...(groups.get(`${a.role}@${a.db}`) ?? []), a]);
    for (const [who, list] of groups) {
      const shown = list.slice(0, 3).map((a) => `${a.c.verb} ${a.c.tables[0] ?? "-"} (queryid ${a.queryid})`);
      items.push({ status: "warn", text: `처음 보는 쿼리 형태 ${list.length}개 — ${who}: ${shown.join(", ")}${list.length > 3 ? " …" : ""}` });
    }
  }

  if (!captured) {
    const due = baseline?.captureOn;
    if (due && kstDate(now) >= due) {
      items.push({ status: "warn", text: `기준선 캡처 기한(${due}) 지남 — pg-baseline.mjs 로 캡처해 PR` });
    } else {
      items.push({ status: "ok", text: `기준선 수집 중 — 형태 ${latest.entries.length}개, ${due ?? "날짜 미정"} 캡처 예정 (그 전에는 새 형태 알림 없음)` });
    }
  }
  if (!items.some((i) => i.status !== "ok")) {
    items.push({
      status: "ok",
      text: `형태 ${latest.entries.length}개 중 24시간 활동 ${active.length}개${captured ? " 모두 기준선 안" : ""} · COPY 내보내기·GoTrue→public·개인정보 전체 조회 없음`,
    });
  }
  return items;
}

/** Baseline from a snapshot. Rule hits are left out unless their queryid is in `allow`. */
export function buildBaseline({ snapshot, existing, publicTables = new Set(), merge = false, allow = [], capturedAt }) {
  const allowed = new Set(allow.map(String));
  const kept = merge ? (existing?.entries ?? []) : [];
  const seen = new Set(kept.map(keyOf));
  const added = [];
  const flagged = [];
  for (const e of snapshot.entries) {
    if (seen.has(keyOf(e))) continue;
    const c = classifyQuery(e.text, { role: e.role, publicTables });
    const entry = { role: e.role, db: e.db, queryid: e.queryid, verb: c.verb, tables: c.tables };
    const reason = alwaysReason(e, c) ?? bulkReadReason(e, c) ?? (c.copy === "from" ? "COPY 가져오기" : null);
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
