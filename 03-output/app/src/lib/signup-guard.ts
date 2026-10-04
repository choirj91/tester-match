/**
 * 이메일 가입 남용 방지 (ADR-0013). 가입 요청 1건 = 인증 메일 1통이므로,
 * 한 IP 가 임의 주소로 메일을 쏟아내거나 전체 발송량이 폭주하는 것을 막는다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { clientIpFromHeaders } from "@/lib/client-ip";

export const SIGNUP_LIMIT_PER_IP_PER_HOUR = 5;
export const SIGNUP_LIMIT_GLOBAL_PER_HOUR = 60;
const WINDOW_MS = 60 * 60 * 1000;

export type SignupGuardVerdict = "ok" | "ip_limited" | "global_limited";

export function signupVerdict(ipCount: number, globalCount: number): SignupGuardVerdict {
  if (ipCount >= SIGNUP_LIMIT_PER_IP_PER_HOUR) return "ip_limited";
  if (globalCount >= SIGNUP_LIMIT_GLOBAL_PER_HOUR) return "global_limited";
  return "ok";
}

export function clientIp(req: Request): string {
  return clientIpFromHeaders(req.headers) ?? "unknown";
}

async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`signup:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 제한 판정 후 통과 시 시도를 기록한다. */
export async function checkAndRecordSignupAttempt(
  supabase: SupabaseClient,
  req: Request,
): Promise<SignupGuardVerdict> {
  const ipHash = await hashIp(clientIp(req));
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const [{ count: ipCount }, { count: globalCount }] = await Promise.all([
    supabase
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since),
    supabase
      .from("signup_attempts")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  const verdict = signupVerdict(ipCount ?? 0, globalCount ?? 0);
  if (verdict !== "ok") return verdict;

  await supabase.from("signup_attempts").insert({ ip_hash: ipHash });
  return "ok";
}
