import type { SupabaseClient } from "@supabase/supabase-js";
import { effectiveVersion, type PolicyKind } from "@/policies/registry";

export type ConsentSource = "signup" | "consent_screen";

/**
 * 회원이 지금 시행 중인 약관 버전에 동의했음을 기록한다 (마이그레이션 20261029000001 의 record_policy_consents).
 * 버전은 서버가 정한다 — 양식 값으로 받지 않는다. 성공하면 true.
 */
export async function recordPolicyConsents(
  admin: SupabaseClient,
  authUserId: string,
  kinds: readonly PolicyKind[],
  source: ConsentSource,
  now: Date,
): Promise<boolean> {
  const versionOf = (kind: PolicyKind) =>
    kinds.includes(kind) ? (effectiveVersion(kind, now)?.version ?? null) : null;
  const { data, error } = await admin.rpc("record_policy_consents", {
    p_auth_user_id: authUserId,
    p_terms_version: versionOf("terms"),
    p_privacy_version: versionOf("privacy"),
    p_source: source,
  });
  if (error || data !== "recorded") {
    console.error("[policy-consent] not recorded", error?.code ?? data);
    return false;
  }
  return true;
}
