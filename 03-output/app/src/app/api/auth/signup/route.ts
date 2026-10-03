import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { signupVerifyEmail } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/site";
import { SignupSchema, isEmailSignupEnabled } from "@/lib/validators/signup";
import { checkAndRecordSignupAttempt } from "@/lib/signup-guard";

export const runtime = "edge";

/**
 * 이메일 회원가입 (ADR-0013). 인증 전 계정을 만들고 인증 링크를 우리 메일로 보낸다.
 * 메일 발송에 실패하면 방금 만든 미인증 계정을 지워 같은 이메일로 다시 시도할 수 있게 한다.
 * public.users 행은 auth.users INSERT 트리거가 메타데이터(nickname, kakao_nickname)로 생성.
 */
export async function POST(req: Request) {
  if (!isEmailSignupEnabled()) {
    return NextResponse.json(
      { ok: false, message: "이메일 회원가입은 준비 중입니다. Google 계정으로 시작해주세요." },
      { status: 403 },
    );
  }

  let payload;
  try {
    payload = SignupSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  // 허니팟이 채워졌으면 봇 — 성공처럼 응답하고 아무것도 하지 않는다
  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  const admin = createSupabaseAdminClient();

  const verdict = await checkAndRecordSignupAttempt(admin, req);
  if (verdict !== "ok") {
    if (verdict === "global_limited") console.error("[auth/signup] global signup limit reached");
    return NextResponse.json(
      { ok: false, message: "가입 요청이 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 },
    );
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: payload.email,
    password: payload.password,
    options: {
      data: { nickname: payload.nickname, kakao_nickname: payload.kakao_nickname },
      redirectTo: `${SITE_URL}/auth/login?verified=1`,
    },
  });

  if (error || !data?.properties?.action_link || !data.user) {
    const alreadyRegistered = /already|registered|exists/i.test(error?.message ?? "");
    if (!alreadyRegistered) console.error("[auth/signup] generateLink failed", error);
    return NextResponse.json(
      {
        ok: false,
        message: alreadyRegistered
          ? "이미 가입된 이메일입니다. 로그인해주세요. (Google 로 가입했다면 Google 로그인을 이용하세요)"
          : "가입 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
      },
      { status: alreadyRegistered ? 409 : 500 },
    );
  }

  const tmpl = signupVerifyEmail({
    nickname: payload.nickname,
    link: data.properties.action_link,
  });
  const sent = await sendEmail({ to: payload.email, ...tmpl });
  if (!sent.ok) {
    console.error("[auth/signup] verification email failed", sent);
    await admin.auth.admin.deleteUser(data.user.id);
    // 502 는 Cloudflare 가 본문을 자체 오류 페이지로 바꿔 안내 문구가 사라진다 — 500 으로 내린다
    return NextResponse.json(
      { ok: false, message: "인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
