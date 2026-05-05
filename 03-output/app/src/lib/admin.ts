import { redirect } from "next/navigation";
import { getCurrentUser, type AppUser } from "@/lib/auth";

/**
 * 관리자 페이지 진입 가드 (서버 컴포넌트용).
 * 로그인 X → /auth/login
 * 일반 사용자 → /
 * admin role → 통과
 */
export async function requireAdminUser(nextPath: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}

/** API 핸들러용 가드. null 이면 401/403 으로 응답해야 함. */
export async function getAdminUser(): Promise<AppUser | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}
