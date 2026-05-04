import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppUser = {
  id: number;
  authUserId: string;
  email: string;
  nickname: string;
  trustScore: number;
  role: "user" | "admin";
};

/**
 * 현재 요청의 인증 사용자 + public.users 매핑을 반환.
 * 인증되지 않았거나 매핑이 아직 생성되지 않았으면 null.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, auth_user_id, email, nickname, trust_score, role")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    email: data.email,
    nickname: data.nickname,
    trustScore: data.trust_score,
    role: data.role,
  };
}
