import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/public-origin";
import {
  REFERRAL_COOKIE,
  REFERRAL_LANDING_PATH,
  parseReferralCode,
  referralCookieOptions,
} from "@/lib/referrals";

type Ctx = { params: Promise<{ id: string }> };

/**
 * 친구 추천 링크 (ADR-0019). 추천 쿠키(30일)를 남기고 첫 화면으로 보낸다. 마지막으로 연 링크가 이긴다.
 * 로그인 여부도, 추천인이 실제 회원인지도 여기서 보지 않는다 — 가입 때(recordReferral) 24시간 안에 만들어진
 * 새 회원인지와 추천인을 확인하므로 이미 회원인 방문자의 쿠키는 기록되지 않는다. 링크를 열 때마다 인증 서버·DB 를 부르지 않는다.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  const response = NextResponse.redirect(`${publicOrigin(request)}${REFERRAL_LANDING_PATH}`, 307);
  // 쿠키를 심는 응답이라 캐시에 남으면 안 된다
  response.headers.set("Cache-Control", "no-store");

  const referrerUserId = parseReferralCode(id);
  if (referrerUserId !== null) {
    response.cookies.set(REFERRAL_COOKIE, String(referrerUserId), referralCookieOptions());
  }
  return response;
}
