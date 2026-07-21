import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBalance } from "@/lib/credits";
import { addUserToTesterGroup, isGroupsAutoJoinEnabled } from "@/lib/google-groups";

export type AppUser = {
  id: number;
  authUserId: string;
  email: string;
  nickname: string;
  trustScore: number;
  role: "user" | "admin";
  balance: number;
};

/**
 * 현재 요청의 인증 사용자 + public.users 매핑을 반환.
 *
 * 동작:
 *   1. cookie-aware SSR 클라이언트로 auth.getUser() — 세션 검증 (Supabase Auth API 호출).
 *   2. 인증 확인 후 admin 클라이언트(service_role)로 public.users 조회 — RLS 우회.
 *
 * 왜 admin 으로 조회하나:
 *   @supabase/ssr + 신 키 포맷 조합에서 JWT 가 DB 쿼리에 자동 부착되지 않는 케이스가
 *   발견됨 (auth.uid() 가 NULL → RLS 차단). auth.getUser() 로 신원은 이미 검증된
 *   상태이므로 admin lookup 은 안전. 클라이언트 사이드 쿼리는 여전히 RLS 적용.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const sessionClient = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await sessionClient.auth.getUser();
  if (!authUser) return null;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("users")
    .select("id, auth_user_id, email, nickname, trust_score, role, groups_joined_at, last_seen_at")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error || !data) return null;

  // 플랫폼 출석 기록 — 1시간 throttle (개발자 모니터링의 "마지막 접속" 신호)
  const lastSeen = data.last_seen_at ? new Date(data.last_seen_at).getTime() : 0;
  if (Date.now() - lastSeen > 60 * 60 * 1000) {
    await admin
      .from("users")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  // Google 그룹 자동 가입 (1회만) — edge runtime waitUntil 로 완료 보장
  if (
    isGroupsAutoJoinEnabled() &&
    data.groups_joined_at == null &&
    data.email &&
    !data.email.endsWith("@deleted.local")
  ) {
    const joinPromise = (async () => {
      try {
        await addUserToTesterGroup(data.email);
        await admin
          .from("users")
          .update({ groups_joined_at: new Date().toISOString() })
          .eq("id", data.id);
      } catch (err) {
        console.error("[auth] group auto-join failed", err);
      }
    })();

    // Cloudflare Pages: 응답 반환 후에도 백그라운드 작업 유지.
    // 로컬 next dev 에선 getRequestContext 가 throw → 그냥 await (첫 로그인 1회라 허용).
    try {
      const { getRequestContext } = await import("@cloudflare/next-on-pages");
      getRequestContext().ctx.waitUntil(joinPromise);
    } catch {
      await joinPromise;
    }
  }

  const balance = await getBalance(admin, data.id);

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    nickname: data.nickname,
    trustScore: data.trust_score,
    role: data.role,
    balance,
  };
}
