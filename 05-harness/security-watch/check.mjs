#!/usr/bin/env node
/**
 * Daily security watch for Tester Match — run by .github/workflows/security-watch.yml.
 *
 * Checks, by category, the attack paths behind the October 2026 incident and posts one
 * Slack message (or prints it with SECWATCH_DRY_RUN=1). Azure checks use a read-only
 * identity; resource names come from secrets so nothing production-specific is committed.
 * Exits 2 when anything is "danger" so the workflow run also turns red.
 */
import { execFileSync } from "node:child_process";
import dns from "node:dns/promises";
import { readFileSync } from "node:fs";
import tls from "node:tls";
import {
  buildSlackPayload,
  category,
  compareVersions,
  findMarkers,
  hostOf,
  isAllowedOutbound,
  latestPatch,
  nextVersionIn,
  scriptTags,
  stylesheetHrefs,
} from "./lib.mjs";

const env = process.env;
const SITE = (env.SECWATCH_SITE_URL || "https://tester-match.knockknock.company").replace(/\/$/, "");
const SITE_HOST = new URL(SITE).host;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
const list = (v) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

// Node runtime end-of-life dates (App Service linuxFxVersion NODE|<major>).
const NODE_EOL = { 18: "2025-04-30", 20: "2026-04-30", 22: "2027-04-30", 24: "2028-04-30" };

async function get(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "ko-KR,ko;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    });
    return { status: res.status, headers: res.headers, text: await res.text() };
  } catch (err) {
    return { status: 0, headers: new Headers(), text: "", error: String(err?.message ?? err) };
  }
}

const state = { servedNext: null };

// ① Page tampering — fake CAPTCHA, injected tag containers, scripts from unknown hosts
async function checkPages() {
  const items = [];
  const pages = new Map();
  for (const p of ["/", "/browse", "/board", "/guide", "/about", "/stats"]) pages.set(p, await get(SITE + p));
  const pick = (html, re) => [...new Set((html.match(re) ?? []).map((h) => h.replace(/^href="/, "")))].slice(0, 5);
  for (const p of [
    ...pick(pages.get("/browse").text, /href="\/browse\/\d+/g),
    ...pick(pages.get("/board").text, /href="\/board\/\d+/g),
  ]) {
    pages.set(p, await get(SITE + p));
  }

  const allowScript = new Set([SITE_HOST, "pagead2.googlesyndication.com", ...list(env.SECWATCH_SCRIPT_ALLOW)]);
  const allowStyle = new Set([SITE_HOST, "fonts.googleapis.com", "cdn.jsdelivr.net"]);
  const chunks = new Set();
  for (const [path, res] of pages) {
    if (res.status !== 200) {
      items.push({ status: "warn", text: `${path} 응답 ${res.status || res.error}` });
      continue;
    }
    for (const s of scriptTags(res.text)) {
      const host = hostOf(s.src, SITE);
      if (!s.quoted && /^https?:/i.test(s.src)) {
        items.push({ status: "danger", text: `${path} 서버 렌더링 뒤 덧붙은 형태의 외부 스크립트(따옴표 없는 src): ${host}` });
      } else if (host && !allowScript.has(host)) {
        items.push({ status: "danger", text: `${path} 허용 목록 밖 외부 스크립트: ${host}` });
      }
      if (host === SITE_HOST && s.src.includes("/_next/static/")) chunks.add(new URL(s.src, SITE).href);
    }
    for (const href of stylesheetHrefs(res.text)) {
      const host = hostOf(href, SITE);
      if (host && !allowStyle.has(host)) items.push({ status: "warn", text: `${path} 허용 목록 밖 스타일시트: ${host}` });
    }
    for (const m of findMarkers(res.text)) items.push({ status: "danger", text: `${path} ${m.label}` });
  }
  for (const url of chunks) {
    const res = await get(url);
    if (res.status !== 200) continue;
    state.servedNext ??= nextVersionIn(res.text);
    for (const m of findMarkers(res.text)) items.push({ status: "danger", text: `JS ${url.split("/").pop()}: ${m.label}` });
  }
  if (!items.length) items.push({ status: "ok", text: `페이지 ${pages.size}개 · JS ${chunks.size}개 검사, 주입 흔적 없음` });
  return category("pages", "① 페이지 변조 (가짜 캡차·스크립트 주입)", items);
}

// ② Framework and dependency vulnerabilities
async function checkDependencies() {
  const items = [];
  const served = state.servedNext;
  const lock = readFileSync("03-output/app/pnpm-lock.yaml", "utf8").match(/^ {2}next@(\d+\.\d+\.\d+):/m)?.[1] ?? null;
  if (!served) {
    items.push({ status: "unknown", text: "운영 Next.js 버전을 응답에서 찾지 못함" });
  } else {
    const reg = await fetch("https://registry.npmjs.org/next", {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.json());
    const newest = latestPatch(Object.keys(reg.versions ?? {}), served);
    if (newest && compareVersions(newest, served) > 0) {
      items.push({ status: "warn", text: `운영 Next.js ${served} → 같은 라인 ${newest} 출시됨. 보안 패치인지 릴리스 노트 확인` });
    } else {
      items.push({ status: "ok", text: `운영 Next.js ${served}, 같은 마이너 라인 최신 (라인 자체의 취약점은 아래 감사 결과 참고)` });
    }
    if (lock && lock !== served) items.push({ status: "warn", text: `저장소 잠금 파일 ${lock} ≠ 운영 ${served} (배포 안 된 변경)` });
  }

  let raw;
  try {
    raw = execFileSync("pnpm", ["audit", "--prod", "--json"], {
      cwd: "03-output/app",
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (err) {
    raw = err.stdout; // non-zero exit when advisories exist
  }
  const audit = JSON.parse(raw || "{}");
  const v = audit.metadata?.vulnerabilities ?? {};
  const advisories = Object.values(audit.advisories ?? {});
  // Critical anywhere, or high in the framework itself, is "danger". Other high advisories sit in
  // transitive build-time packages and stay "warn" so the daily report does not go red every day.
  const FRAMEWORK = new Set(["next", "react", "react-dom"]);
  const urgent = advisories.filter((a) => a.severity === "critical" || (a.severity === "high" && FRAMEWORK.has(a.module_name)));
  const otherHigh = advisories.filter((a) => a.severity === "high" && !FRAMEWORK.has(a.module_name));
  const describe = (list) => list.slice(0, 4).map((a) => `${a.module_name} (${a.severity}) ${a.title}`).join(" / ");
  // A minor line can stop receiving fixes; say which version clears the framework advisories.
  const nextFloors = advisories
    .filter((a) => a.module_name === "next" && (a.severity === "critical" || a.severity === "high"))
    .map((a) => String(a.patched_versions).match(/>=\s*(\d+\.\d+\.\d+)/)?.[1])
    .filter(Boolean);
  if (nextFloors.length) {
    const floor = nextFloors.reduce((a, b) => (compareVersions(a, b) >= 0 ? a : b));
    items.push({ status: "danger", text: `Next.js 고위험 취약점 ${nextFloors.length}건은 ${floor} 이상에서만 해소 — 업그레이드 필요` });
  }
  if (urgent.length) {
    items.push({ status: "danger", text: `즉시 조치할 취약점 ${urgent.length}건: ${describe(urgent)}` });
  }
  if (otherHigh.length) {
    const modules = [...new Set(otherHigh.map((a) => a.module_name))].join(", ");
    items.push({ status: "warn", text: `간접 의존성 high ${otherHigh.length}건 (${modules}) — 정기 업데이트 때 정리` });
  }
  if (!urgent.length && !otherHigh.length) {
    if ((v.moderate ?? 0) > 0) items.push({ status: "warn", text: `운영 의존성 중간 위험 취약점 ${v.moderate}건` });
    else items.push({ status: "ok", text: "운영 의존성 알려진 취약점 없음 (pnpm audit)" });
  }
  return category("deps", "② 프레임워크·의존성 취약점", items);
}

// ③ Security settings visible from outside
async function checkSurface() {
  const items = [];
  const home = await get(`${SITE}/`);
  const h = (n) => home.headers.get(n);
  const missing = [];
  if (!h("content-security-policy")) missing.push("CSP");
  if (!h("strict-transport-security")) missing.push("HSTS");
  if (!h("x-content-type-options")) missing.push("X-Content-Type-Options");
  if (!h("x-frame-options") && !/frame-ancestors/i.test(h("content-security-policy") ?? "")) missing.push("X-Frame-Options");
  if (missing.length) items.push({ status: "warn", text: `보안 헤더 없음: ${missing.join(", ")}` });

  for (const p of ["/.env", "/.git/HEAD", "/.git/config", "/.next/BUILD_ID"]) {
    const r = await get(SITE + p);
    if (r.status === 200) items.push({ status: "danger", text: `민감 경로가 열려 있음: ${p}` });
  }
  const api = await get(`${SITE}/api/apps/1`);
  if (api.status === 200) items.push({ status: "danger", text: "비로그인으로 앱 정보 API가 응답함 (초대 링크 노출)" });

  const days = await new Promise((resolve) => {
    const sock = tls.connect({ host: SITE_HOST, port: 443, servername: SITE_HOST, timeout: 15000 }, () => {
      const exp = new Date(sock.getPeerCertificate().valid_to);
      sock.end();
      resolve(Math.floor((exp - Date.now()) / 86400000));
    });
    sock.on("error", () => resolve(null));
    sock.on("timeout", () => {
      sock.destroy();
      resolve(null);
    });
  });
  if (days === null) items.push({ status: "unknown", text: "TLS 인증서 확인 실패" });
  else if (days < 7) items.push({ status: "danger", text: `TLS 인증서 만료 ${days}일 전` });
  else if (days < 21) items.push({ status: "warn", text: `TLS 인증서 만료 ${days}일 전` });

  const parent = SITE_HOST.split(".").slice(-2).join(".");
  try {
    const ns = await dns.resolveNs(parent);
    const expect = env.SECWATCH_EXPECTED_NS || "azure-dns";
    if (!ns.some((n) => n.includes(expect))) items.push({ status: "danger", text: `${parent} 네임서버 변경 감지: ${ns.join(", ")}` });
  } catch (err) {
    items.push({ status: "unknown", text: `네임서버 조회 실패 (${err.code ?? err.message})` });
  }
  try {
    const cname = await dns.resolveCname(SITE_HOST);
    const suffix = env.SECWATCH_EXPECTED_CNAME_SUFFIX || ".azurewebsites.net";
    if (!cname.every((c) => c.endsWith(suffix))) items.push({ status: "danger", text: `${SITE_HOST} CNAME 변경 감지: ${cname.join(", ")}` });
  } catch (err) {
    if (err.code !== "ENODATA") items.push({ status: "unknown", text: `CNAME 조회 실패 (${err.code ?? err.message})` });
  }
  for (const host of list(env.SECWATCH_FORBIDDEN_HOSTS)) {
    const r = await get(`https://${host}/`);
    if (r.status === 200) items.push({ status: "danger", text: `삭제한 환경 주소가 다시 응답함: ${host}` });
  }
  if (!items.length) items.push({ status: "ok", text: "보안 헤더·민감 경로·API·인증서·DNS 이상 없음" });
  return category("surface", "③ 보안 설정·노출", items);
}

// Azure helpers (read-only identity, az CLI logged in by the workflow)
const RG = env.SECWATCH_RG;
const WEBAPP = env.SECWATCH_WEBAPP;
const APPI = env.SECWATCH_APPINSIGHTS;
const azureReady = env.SECWATCH_AZURE_OK === "true" && RG && WEBAPP && APPI;

function az(args) {
  const out = execFileSync("az", [...args, "-o", "json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out || "null");
}

function ai(query) {
  const r = az(["monitor", "app-insights", "query", "--app", APPI, "-g", RG, "--offset", "1d", "--analytics-query", query]);
  const t = r.tables[0];
  return t.rows.map((row) => Object.fromEntries(t.columns.map((c, i) => [c.name, row[i]])));
}

// ④ Attack attempts and exfiltration seen from inside (App Insights, last 24h)
function checkAttacks() {
  if (!azureReady) return category("attacks", "④ 공격 시도·유출 징후 (24시간)", [{ status: "unknown", text: "Azure 읽기 전용 로그인 실패 또는 설정 누락" }]);
  const items = [];
  // The app has no server actions, so page-path POSTs are probes. Long-running ones matched
  // the remote-code-execution requests in October (22–58 s).
  const [post] = ai(
    "requests | where timestamp > ago(1d) | extend path = tostring(parse_url(url).Path) | where name startswith 'POST' and not(path startswith '/api') and not(path startswith '/_next') and not(path startswith '/auth') | summarize n = count(), slow = countif(duration > 10000)",
  );
  if (post.slow > 0) items.push({ status: "danger", text: `페이지 경로 POST 중 10초 이상 걸린 요청 ${post.slow}건 — 원격 코드 실행 시도 의심` });
  else if (post.n > 0) items.push({ status: "ok", text: `페이지 경로 탐색 요청 ${post.n}건, 실행 흔적 없음` });

  const allow = ["127.0.0.1", "localhost", ...list(env.SECWATCH_OUTBOUND_ALLOW)];
  const outbound = ai("dependencies | where timestamp > ago(1d) | summarize n = count() by target");
  for (const d of outbound.filter((x) => !isAllowedOutbound(x.target, allow))) {
    items.push({ status: "danger", text: `서버가 처음 보는 외부 주소와 통신: ${d.target} (${d.n}회) — 비밀 유출 확인 필요` });
  }

  const [rate] = ai("requests | where timestamp > ago(1d) | summarize total = count(), e5 = countif(toint(resultCode) >= 500)");
  const pct = rate.total ? (rate.e5 / rate.total) * 100 : 0;
  if (pct > 10) items.push({ status: "danger", text: `5xx 오류율 ${pct.toFixed(1)}% (${rate.e5}/${rate.total})` });
  else if (pct > 2) items.push({ status: "warn", text: `5xx 오류율 ${pct.toFixed(1)}% (${rate.e5}/${rate.total})` });

  const [auth] = ai("requests | where timestamp > ago(1d) and name == 'POST /auth/v1/token' | summarize bad = countif(resultCode == '400' or resultCode == '401'), total = count()");
  if (auth.bad > 200) items.push({ status: "warn", text: `로그인 토큰 실패 ${auth.bad}건 — 계정 대입 공격 가능성` });

  if (!items.some((i) => i.status !== "ok")) items.push({ status: "ok", text: `외부 통신 ${outbound.length}곳 모두 허용 목록, 5xx ${pct.toFixed(1)}%` });
  return category("attacks", "④ 공격 시도·유출 징후 (24시간)", items);
}

// ⑤ Cloud configuration drift
function checkCloud() {
  if (!azureReady) return category("cloud", "⑤ 클라우드 구성", [{ status: "unknown", text: "Azure 읽기 전용 로그인 실패 또는 설정 누락" }]);
  const items = [];
  const expected = new Set(list(env.SECWATCH_EXPECTED_APPS));
  const apps = az(["webapp", "list", "-g", RG, "--query", "[].name"]) ?? [];
  const fn = az(["functionapp", "list", "-g", RG, "--query", "[].name"]) ?? [];
  for (const name of new Set([...apps, ...fn])) {
    if (expected.size && !expected.has(name)) items.push({ status: "danger", text: `알 수 없는 앱이 생김: ${name}` });
  }
  for (const kind of ["scm", "ftp"]) {
    const allow = az(["resource", "show", "-g", RG, "--namespace", "Microsoft.Web", "--parent", `sites/${WEBAPP}`, "--resource-type", "basicPublishingCredentialsPolicies", "-n", kind, "--query", "properties.allow"]);
    if (allow === true) items.push({ status: "warn", text: `배포 기본 인증(${kind.toUpperCase()}) 켜져 있음 — 유출된 게시 자격 증명으로 파일 변경 가능` });
  }
  const stack = az(["webapp", "config", "show", "-g", RG, "-n", WEBAPP, "--query", "linuxFxVersion"]) ?? "";
  const major = Number(String(stack).match(/NODE\|(\d+)/i)?.[1]);
  if (NODE_EOL[major] && new Date(NODE_EOL[major]) < new Date()) {
    items.push({ status: "warn", text: `런타임 ${stack} 지원 종료(${NODE_EOL[major]}) — 보안 패치 없음` });
  }
  const writes = az([
    "monitor", "activity-log", "list", "-g", RG, "--offset", "1d",
    "--query", "[?status.value=='Succeeded' && authorization.action != null && !ends_with(authorization.action, '/read')].authorization.action",
  ]) ?? [];
  const sensitive = writes.filter((a) => /roleAssignments|policyAssignments|userAssignedIdentities|basicPublishingCredentialsPolicies|sites\/config\/write|vaults\/.*\/write|firewallRules/i.test(a));
  if (sensitive.length) items.push({ status: "warn", text: `권한·설정 변경 ${sensitive.length}건 (${[...new Set(sensitive.map((a) => a.split("/").slice(-2).join("/")))].join(", ")}) — 본인 작업인지 확인` });
  if (!items.length) items.push({ status: "ok", text: `앱 ${apps.length + fn.length}개 예상대로, 구성 변경 ${writes.length}건 중 민감 변경 없음` });
  return category("cloud", "⑤ 클라우드 구성", items);
}

async function run(fn, key, title) {
  try {
    return await fn();
  } catch (err) {
    return category(key, title, [{ status: "unknown", text: `점검 실패: ${String(err?.message ?? err).slice(0, 160)}` }]);
  }
}

const categories = [
  await run(checkPages, "pages", "① 페이지 변조 (가짜 캡차·스크립트 주입)"),
  await run(checkDependencies, "deps", "② 프레임워크·의존성 취약점"),
  await run(checkSurface, "surface", "③ 보안 설정·노출"),
  await run(checkAttacks, "attacks", "④ 공격 시도·유출 징후 (24시간)"),
  await run(checkCloud, "cloud", "⑤ 클라우드 구성"),
];

const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
const runUrl = env.GITHUB_RUN_ID ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}` : "";
const payload = buildSlackPayload({ siteUrl: SITE, date, runUrl, categories });

for (const c of categories) {
  console.log(`[${c.status}] ${c.title}`);
  for (const i of c.items) console.log(`   - [${i.status}] ${i.text}`);
}

if (env.SECWATCH_DRY_RUN === "1" || !env.SECWATCH_SLACK_WEBHOOK_URL) {
  console.log(env.SECWATCH_DRY_RUN === "1" ? "\n(dry run — Slack not sent)" : "\n(SECWATCH_SLACK_WEBHOOK_URL not set — Slack not sent)");
} else {
  const res = await fetch(env.SECWATCH_SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  console.log(`Slack: ${res.status}`);
  if (!res.ok) process.exitCode = 1;
}
if (categories.some((c) => c.status === "danger")) process.exitCode = 2;
