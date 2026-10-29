import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { CONSENT_PATH, consentNextPath, consentPagePath } from "@/lib/consent-gate";
import { recordPolicyConsents } from "@/lib/policy-consent";
import { publicOrigin } from "@/lib/public-origin";
import { isSameOriginRequest } from "@/lib/signup-confirm";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function redirectTo(req: Request, path: string) {
  const res = NextResponse.redirect(new URL(path, publicOrigin(req)), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** 약관 동의 화면(/auth/consent)의 양식이 호출 — 지금 시행 중인 버전에 대한 동의를 기록한다 */
export async function POST(req: Request) {
  // 다른 사이트(같은 상위 도메인의 서브도메인 포함)에서 온 제출은 받지 않는다
  if (!isSameOriginRequest(publicOrigin(req), req.headers)) return redirectTo(req, CONSENT_PATH);

  const form = await req.formData().catch(() => null);
  const rawNext = form?.get("next");
  const next = consentNextPath(typeof rawNext === "string" ? rawNext : null, publicOrigin(req));

  const user = await getCurrentUser();
  if (!user) return redirectTo(req, "/auth/login");
  const pending = user.pendingPolicies ?? [];
  if (pending.length === 0) return redirectTo(req, next);
  if (form?.get("agreed") !== "on") return redirectTo(req, consentPagePath(next, "agree"));

  const recorded = await recordPolicyConsents(
    createSupabaseAdminClient(),
    user.authUserId,
    pending,
    "consent_screen",
    new Date(),
  );
  return redirectTo(req, recorded ? next : consentPagePath(next, "save"));
}
