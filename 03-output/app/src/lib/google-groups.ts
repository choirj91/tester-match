/**
 * Google Workspace Admin SDK — Directory API 클라이언트.
 * Edge runtime 호환: crypto.subtle 기반 서비스 계정 JWT 서명.
 *
 * 사용 흐름 (사용자 사전 준비):
 *   1) Cloud Identity Free 또는 Google Workspace 계정 준비 (도메인 필요)
 *   2) Google Cloud Console 프로젝트 → Admin SDK API 활성화
 *   3) Service Account 생성 → JSON 키 다운로드
 *   4) Service Account 편집 → "Enable G Suite Domain-wide Delegation" 체크
 *   5) Workspace Admin 콘솔 → 보안 → API 컨트롤 → 도메인 전체 위임
 *      → 위 Service Account 클라이언트 ID 추가 + Scope:
 *         https://www.googleapis.com/auth/admin.directory.group.member
 *   6) Cloudflare Pages 환경변수:
 *        - GOOGLE_SERVICE_ACCOUNT_JSON  (JSON string 전체)
 *        - GOOGLE_ADMIN_EMAIL           (impersonation super admin 이메일)
 *        - TESTER_GROUP_EMAIL           (예: testers@yourdomain.com)
 *
 * 환경변수 미설정 시 addUserToTesterGroup() 은 조용히 no-op.
 * 이렇게 하면 개발/테스트 환경에서 문제없이 동작.
 */

type ServiceAccount = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const TOKEN_URI = "https://oauth2.googleapis.com/token";
const DIRECTORY_MEMBERS_URL = (groupEmail: string) =>
  `https://admin.googleapis.com/admin/directory/v1/groups/${encodeURIComponent(groupEmail)}/members`;

const SCOPE = "https://www.googleapis.com/auth/admin.directory.group.member";

/**
 * 사용자 이메일을 Tester 그룹에 추가.
 * - 성공: undefined
 * - 이미 멤버: undefined (409 conflict 무시)
 * - 미설정/오류: 콘솔 로그만, 예외 던지지 않음
 */
export async function addUserToTesterGroup(email: string): Promise<void> {
  const sa = getServiceAccount();
  const groupEmail = process.env.TESTER_GROUP_EMAIL;
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!sa || !groupEmail || !adminEmail) return; // 설정 안 됨 → no-op

  try {
    const jwt = await buildJwt(sa, adminEmail, SCOPE);
    const token = await exchangeJwtForToken(jwt);
    const res = await fetch(DIRECTORY_MEMBERS_URL(groupEmail), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, role: "MEMBER" }),
    });
    if (res.status === 409) return; // 이미 멤버
    if (!res.ok) {
      const text = await res.text();
      console.error("[google-groups] add failed", res.status, text);
      return;
    }
  } catch (err) {
    console.error("[google-groups] exception", err);
  }
}

export type GroupMember = {
  email: string;
  role: string;
  status: string;
  type: string;
};

/**
 * 그룹 전체 멤버 목록 (페이지네이션 자동 처리).
 * 미설정/실패 시 null — 호출부에서 "조회 불가" 안내.
 */
export async function listGroupMembers(): Promise<GroupMember[] | null> {
  const sa = getServiceAccount();
  const groupEmail = process.env.TESTER_GROUP_EMAIL;
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!sa || !groupEmail || !adminEmail) return null;

  try {
    const jwt = await buildJwt(sa, adminEmail, SCOPE);
    const token = await exchangeJwtForToken(jwt);

    const members: GroupMember[] = [];
    let pageToken: string | undefined;
    // 안전 상한 20페이지 (200명 × 20 = 4,000명)
    for (let page = 0; page < 20; page++) {
      const url = new URL(DIRECTORY_MEMBERS_URL(groupEmail));
      url.searchParams.set("maxResults", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        console.error("[google-groups] list failed", res.status, await res.text());
        return null;
      }
      const json = (await res.json()) as {
        members?: Array<{ email?: string; role?: string; status?: string; type?: string }>;
        nextPageToken?: string;
      };
      for (const m of json.members ?? []) {
        if (!m.email) continue;
        members.push({
          email: m.email,
          role: m.role ?? "MEMBER",
          status: m.status ?? "-",
          type: m.type ?? "USER",
        });
      }
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
    return members;
  } catch (err) {
    console.error("[google-groups] list exception", err);
    return null;
  }
}

/**
 * 특정 이메일이 그룹 멤버인지 실시간 확인.
 * true/false = 확정 답, null = 확인 불가 (미설정·API 오류).
 */
export async function isGroupMember(email: string): Promise<boolean | null> {
  const sa = getServiceAccount();
  const groupEmail = process.env.TESTER_GROUP_EMAIL;
  const adminEmail = process.env.GOOGLE_ADMIN_EMAIL;
  if (!sa || !groupEmail || !adminEmail) return null;

  try {
    const jwt = await buildJwt(sa, adminEmail, SCOPE);
    const token = await exchangeJwtForToken(jwt);
    const res = await fetch(
      `${DIRECTORY_MEMBERS_URL(groupEmail)}/${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (res.status === 404) return false;
    if (!res.ok) {
      console.error("[google-groups] member check failed", res.status);
      return null;
    }
    return true;
  } catch (err) {
    console.error("[google-groups] member check exception", err);
    return null;
  }
}

/**
 * 이 서비스가 Groups 자동 가입 기능을 활성화한 상태인지 여부.
 * UI 에서 안내 문구 표시 조건 등에 사용.
 */
export function isGroupsAutoJoinEnabled(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON &&
    process.env.GOOGLE_ADMIN_EMAIL &&
    process.env.TESTER_GROUP_EMAIL
  );
}

export function getTesterGroupEmail(): string | null {
  return process.env.TESTER_GROUP_EMAIL ?? null;
}

export function getTesterGroupUrl(): string | null {
  // 별도로 지정 (Google Groups 웹 뷰) — 없으면 이메일 기반 추정
  const explicit = process.env.TESTER_GROUP_URL;
  if (explicit) return explicit;
  const email = getTesterGroupEmail();
  if (!email) return null;
  const local = email.split("@")[0];
  return `https://groups.google.com/a/${email.split("@")[1] ?? ""}/g/${local}`;
}

// ── 내부 함수 ──────────────────────────────────────────────────────────

function getServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch (err) {
    console.error("[google-groups] service account JSON parse failed", err);
    return null;
  }
}

async function buildJwt(
  sa: ServiceAccount,
  subject: string,
  scope: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope,
    aud: TOKEN_URI,
    exp: now + 3600,
    iat: now,
    sub: subject,
  };
  const encHeader = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signInput = `${encHeader}.${encPayload}`;

  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(signInput),
  );
  return `${signInput}.${b64url(new Uint8Array(sig))}`;
}

async function exchangeJwtForToken(jwt: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const res = await fetch(TOKEN_URI, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`token exchange failed ${res.status}: ${t}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("no access_token in response");
  return json.access_token;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // pem: -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const der = base64ToArrayBuffer(cleaned);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}
