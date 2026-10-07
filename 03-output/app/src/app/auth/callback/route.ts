import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/public-origin";
import { supabaseGlobalOptions } from "@/lib/supabase/route-fetch";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { safeInternalPath } from "@/lib/safe-redirect";
import {
  REFERRAL_COOKIE,
  isReferralSettled,
  parseReferralCode,
  readReferralCookie,
  recordReferralForLogin,
  referralCookieOptions,
  withAttributionTimeout,
} from "@/lib/referrals";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Google 로그인이 끝났는데 회원 행이 없으면 서버가 연결을 다시 시도한다 (마이그레이션 000023 의
 * ensure_member_row). 가입 트리거가 연결을 건너뛴 드문 경우 — 같은 주소로 먼저 만들어진 미인증
 * 계정을 Google 로그인이 이어받은 경우 등 — 를 로그인 한 번 안에서 복구한다.
 * 어떤 실패도 로그인을 막지 않는다.
 */
async function repairMemberRow(session: Session | null): Promise<void> {
  if (!session) return;
  try {
    const admin = createSupabaseAdminClient();
    const { data: row, error } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle();
    if (error || row) return;

    const { data: outcome, error: rpcError } = await admin.rpc("ensure_member_row", {
      p_auth_user_id: session.user.id,
    });
    console.error("[auth/callback] member row repair", rpcError?.code ?? outcome);
    if (rpcError || outcome !== "linked") return;

    // 복구 과정에서 비밀번호가 지워졌을 수 있다 — 그 비밀번호로 만들어진 다른 세션을 폐기한다
    await admin.auth.admin.signOut(session.access_token, "others");
  } catch (err) {
    console.error("[auth/callback] member row repair failed", err instanceof Error ? err.message : "unknown");
  }
}

/**
 * 추천 링크(/r/[id])로 들어와 Google 로 처음 가입한 회원이면 추천 관계를 기록한다 (ADR-0019).
 * 회원 행 복구가 끝난 뒤에 부른다. 새 회원인지(행 생성 24시간 이내)는 recordReferral 이 판단한다.
 * 쿠키는 결과가 정해지면 지운다 — 기존 회원의 재로그인이면 다시 시도하지 않게. 일시 실패·2초 초과면 남겨
 * 다음 로그인에서 다시 시도한다. 어떤 실패도 로그인을 막거나 늦추지 않는다.
 */
async function attributeReferral(
  request: Request,
  session: Session | null,
  response: NextResponse,
): Promise<void> {
  const raw = readReferralCookie(request.headers.get("cookie"));
  if (raw === null || !session) return;
  const clearCookie = () => response.cookies.set(REFERRAL_COOKIE, "", referralCookieOptions(0));
  const referrerUserId = parseReferralCode(raw);
  if (referrerUserId === null) {
    clearCookie();
    return;
  }
  try {
    const outcome = await withAttributionTimeout(
      recordReferralForLogin(createSupabaseAdminClient(), {
        authUserId: session.user.id,
        referrerUserId,
      }),
    );
    if (isReferralSettled(outcome)) clearCookie();
  } catch (err) {
    console.error("[auth/callback] referral attribution failed", err instanceof Error ? err.message : "unknown");
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request);
  const code = searchParams.get("code");
  // origin 뒤에 그대로 붙이면 ".evil.com" 같은 값이 호스트를 늘려 밖으로 나간다 — 내부 경로만 허용
  const next = safeInternalPath(searchParams.get("next"), origin);

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.redirect(`${origin}/auth/login?error=env_missing`);
  }

  // 응답 객체를 먼저 만들고, Supabase SDK 가 setAll 로 호출할 때
  // 응답 cookies 에 직접 기록 → NextResponse.redirect 가 Set-Cookie 헤더를 보장.
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(url, key, {
    ...supabaseGlobalOptions(),
    cookies: {
      getAll() {
        return request.headers
          .get("cookie")
          ?.split(";")
          .map((c) => {
            const [name, ...rest] = c.trim().split("=");
            return { name, value: rest.join("=") };
          })
          .filter((c) => c.name) ?? [];
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] exchange failed", {
      code: error.code,
      message: error.message,
    });
    return NextResponse.redirect(`${origin}/auth/login?error=exchange_failed`);
  }

  await repairMemberRow(data.session);
  await attributeReferral(request, data.session, response);

  return response;
}
