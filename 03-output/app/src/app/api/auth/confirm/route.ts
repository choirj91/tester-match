import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CONFIRM_COOKIE,
  CONFIRM_COOKIE_MAX_AGE_SECONDS,
  confirmResultPath,
  isPreRegisteredRow,
  isSameOriginRequest,
  isValidTokenHash,
  type ConfirmResult,
} from "@/lib/signup-confirm";
import {
  CompleteSignupSchema,
  completeSignupErrorCode,
  type CompleteSignupInput,
} from "@/lib/validators/signup";

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;
const PASSWORD_SAVE_ATTEMPTS = 2;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function redirectTo(req: Request, path: string) {
  const res = NextResponse.redirect(new URL(path, req.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * 인증 메일의 링크가 여는 곳. 여기서는 인증을 확정하지 않는다 —
 * 토큰을 HttpOnly 쿠키로 옮기고 확인 화면으로 보낸다 (메일 스캐너의 자동 열기 방지).
 * 토큰이 잘못된 요청은 기존 쿠키를 건드리지 않는다 (남이 보낸 링크로 진행 중인 가입을 지울 수 없게).
 */
export async function GET(req: Request) {
  const tokenHash = new URL(req.url).searchParams.get("token_hash");
  if (!isValidTokenHash(tokenHash)) {
    return redirectTo(req, confirmResultPath({ ok: false, reason: "link" }));
  }

  const res = redirectTo(req, "/auth/confirm");
  res.cookies.set(CONFIRM_COOKIE, tokenHash, {
    ...COOKIE_BASE,
    maxAge: CONFIRM_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}

async function savePassword(
  admin: AdminClient,
  authUserId: string,
  password: string,
): Promise<boolean> {
  for (let attempt = 1; attempt <= PASSWORD_SAVE_ATTEMPTS; attempt++) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, { password });
    if (!error) return true;
    console.error("[auth/confirm] password save failed", attempt, error.code ?? error.message);
  }
  return false;
}

/**
 * 인증은 됐는데 비밀번호를 저장하지 못한 계정은 임시 비밀번호만 남아 로그인할 방법이 없다.
 * 같은 주소로 다시 가입할 수 있게 지운다. 단, 가입 이전부터 있던 회원 행이 딸려 있으면
 * 로그인 삭제가 그 행까지 지우므로(cascade) 지우지 않는다.
 */
async function discardConfirmedAccount(
  admin: AdminClient,
  authUserId: string,
  authCreatedAt: string,
): Promise<void> {
  const { data: row, error } = await admin
    .from("users")
    .select("created_at")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error || (row && isPreRegisteredRow(row.created_at, authCreatedAt))) {
    console.error("[auth/confirm] account kept after password failure", error?.code ?? "has_row");
    return;
  }
  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId);
  if (deleteError) {
    console.error("[auth/confirm] account cleanup failed", deleteError.code ?? deleteError.message);
  }
}

async function confirmSignup(tokenHash: string, input: CompleteSignupInput): Promise<ConfirmResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("[auth/confirm] supabase env missing");
    return { ok: false, reason: "link" };
  }

  // 세션을 쿠키에 남기지 않는 클라이언트 — 인증만 확정하고 로그인은 비밀번호로 하게 한다
  const verifier = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
  if (error || !data.user) {
    console.error("[auth/confirm] verify failed", error?.code ?? error?.message ?? "no_user");
    return { ok: false, reason: "link" };
  }

  // 메일 링크를 연 사람(= 그 주소의 주인)이 정한 비밀번호만 계정에 들어간다
  const admin = createSupabaseAdminClient();
  const saved = await savePassword(admin, data.user.id, input.password);

  // 인증 과정에서 생긴 세션과, 그 사이 다른 비밀번호로 만들어졌을 수 있는 세션을 전부 폐기한다
  const accessToken = data.session?.access_token;
  if (accessToken) {
    const { error: revokeError } = await admin.auth.admin.signOut(accessToken, "global");
    if (revokeError) {
      console.error("[auth/confirm] session revoke failed", revokeError.code ?? revokeError.message);
    }
  }

  if (!saved) {
    await discardConfirmedAccount(admin, data.user.id, data.user.created_at);
    return { ok: false, reason: "password" };
  }

  // 회원 행은 여기서만 만든다 — 비밀번호가 메일 주인의 것으로 바뀌고 다른 세션이 폐기된 뒤에.
  // 닉네임도 메일 링크를 연 사람이 입력한 값만 쓴다. (트리거는 이메일 가입의 회원 행을 만들지 않는다.)
  const { data: outcome, error: memberError } = await admin.rpc("create_email_member", {
    p_auth_user_id: data.user.id,
    p_nickname: input.nickname,
    p_kakao_nickname: input.kakao_nickname,
  });
  if (memberError || (outcome !== "linked" && outcome !== "already_linked")) {
    console.error("[auth/confirm] member row not created", memberError?.code ?? outcome);
    return { ok: false, reason: "member" };
  }

  return { ok: true };
}

/** 확인 화면의 양식이 호출 — 닉네임·비밀번호·약관 동의를 받아 여기서 가입을 확정한다. */
export async function POST(req: Request) {
  // 다른 사이트(같은 상위 도메인의 서브도메인 포함)에서 온 제출은 받지 않는다. 쿠키도 건드리지 않는다.
  if (!isSameOriginRequest(req.url, req.headers)) return redirectTo(req, "/auth/confirm");

  const cookieStore = await cookies();
  const tokenHash = cookieStore.get(CONFIRM_COOKIE)?.value;
  if (!isValidTokenHash(tokenHash)) {
    return redirectTo(req, confirmResultPath({ ok: false, reason: "link" }));
  }

  const form = await req.formData().catch(() => null);
  const parsed = CompleteSignupSchema.safeParse({
    nickname: form?.get("nickname"),
    kakao_nickname: form?.get("kakao_nickname"),
    password: form?.get("password"),
    password_confirm: form?.get("password_confirm"),
    agreed: form?.get("agreed"),
  });
  if (!parsed.success) {
    // 토큰 쿠키는 그대로 둔다 — 확인 화면에서 다시 입력할 수 있다
    return redirectTo(req, `/auth/confirm?error=${completeSignupErrorCode(parsed.error)}`);
  }

  // 토큰을 실제로 쓴 뒤에만 쿠키를 지운다
  const res = redirectTo(req, confirmResultPath(await confirmSignup(tokenHash, parsed.data)));
  res.cookies.set(CONFIRM_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
  return res;
}
