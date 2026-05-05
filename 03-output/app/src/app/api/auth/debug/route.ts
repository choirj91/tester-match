import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

/**
 * 인증 상태 진단용 엔드포인트. 운영 배포 전 제거 또는 admin 가드 추가 필요.
 *
 * GET /api/auth/debug 응답 의미:
 *   - hasSession: false → 쿠키 미수신 또는 세션 만료
 *   - hasPublicUser (via session): false → public.users 에 auth_user_id 매핑 없음
 *     (RLS 차단 또는 트리거 미실행)
 *   - hasPublicUser (via admin): false → email 로도 row 없음 → 트리거가 안 돈 것
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  const cookieHeader = request.headers.get("cookie") ?? "";
  const supabaseCookies = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((name) => name.startsWith("sb-"));

  if (!authUser) {
    return NextResponse.json({
      ok: false,
      stage: "auth.getUser",
      hasSession: false,
      authError: authError?.message ?? null,
      cookieCount: supabaseCookies.length,
      cookieNames: supabaseCookies,
      hint:
        supabaseCookies.length === 0
          ? "Supabase 인증 쿠키가 없음 — 콜백에서 set 실패 또는 도메인/SameSite 문제."
          : "쿠키는 있으나 세션 검증 실패 — 만료 또는 키 불일치.",
    });
  }

  const { data: pubUserViaSession, error: rlsError } = await supabase
    .from("users")
    .select("id, auth_user_id, email, nickname")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  const admin = createSupabaseAdminClient();
  const { data: pubUserViaAdmin } = await admin
    .from("users")
    .select("id, auth_user_id, email, nickname")
    .eq("email", authUser.email ?? "")
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    hasSession: true,
    auth: {
      id: authUser.id,
      email: authUser.email,
    },
    cookieCount: supabaseCookies.length,
    publicUser: {
      viaSession: pubUserViaSession,
      viaAdmin: pubUserViaAdmin,
      sessionError: rlsError?.message ?? null,
    },
    hint:
      !pubUserViaSession && pubUserViaAdmin
        ? "RLS 또는 auth_user_id 매핑 깨짐. admin 으로는 보이지만 세션으로는 못 봄."
        : !pubUserViaAdmin
          ? "public.users 에 row 자체가 없음. handle_new_auth_user 트리거 미실행 의심."
          : "정상.",
  });
}
