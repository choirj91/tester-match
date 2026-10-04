import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { signupVerifyEmail } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/site";
import { SignupSchema, isEmailSignupEnabled } from "@/lib/validators/signup";
import { checkAndRecordSignupAttempt } from "@/lib/signup-guard";
import { buildConfirmUrl, randomPassword } from "@/lib/signup-confirm";

export const runtime = "edge";

const GENERIC_FAILURE = "가입 처리에 실패했습니다. 잠시 후 다시 시도해주세요.";
const ALREADY_REGISTERED =
  "이미 가입된 이메일입니다. 로그인해주세요. (Google 로 가입했다면 Google 로그인을 이용하세요)";

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, message }, { status });
}

function isEmailTaken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "email_exists" || /already|registered|exists/i.test(error.message ?? "");
}

/**
 * 이메일 회원가입 1단계 (ADR-0013, 2026-10-04 보강).
 *
 * 이메일만 받아 인증 전 계정과 인증 메일을 만든다. 닉네임·비밀번호·약관 동의는 메일의 링크를
 * 연 사람이 확인 화면에서 입력한다 — 여기서 받으면 남의 주소를 넣은 사람이 정한 값이 그 주소
 * 주인의 계정에 들어간다. 인증 전 계정은 아무도 모르는 임시 비밀번호로만 존재한다.
 *
 * 회원 행(public.users)은 확인 단계가 비밀번호를 저장한 뒤 서버가 만든다 — 인증 전 계정에도,
 * 우리 확인 화면을 거치지 않고 인증된 계정에도 회원 행은 없다. 일괄 등록으로 미리 만들어진
 * 회원 행에는 이메일 가입으로 연결되지 않는다 (Google 로그인 전용).
 */
export async function POST(req: Request) {
  if (!isEmailSignupEnabled()) {
    return fail("이메일 회원가입은 준비 중입니다. Google 계정으로 시작해주세요.", 403);
  }

  let payload;
  try {
    payload = SignupSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return fail(message, 400);
  }

  // 허니팟이 채워졌으면 봇 — 성공처럼 응답하고 아무것도 하지 않는다
  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  const admin = createSupabaseAdminClient();

  const verdict = await checkAndRecordSignupAttempt(admin, req);
  if (verdict !== "ok") {
    if (verdict === "global_limited") console.error("[auth/signup] global signup limit reached");
    return fail("가입 요청이 많습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  // 미리 등록된(로그인 연결이 없는) 회원 행은 Google 로그인으로만 연결된다
  const { data: existingRow, error: rowError } = await admin
    .from("users")
    .select("auth_user_id")
    .eq("email", payload.email)
    .maybeSingle();
  if (rowError) {
    console.error("[auth/signup] member lookup failed", rowError.code);
    return fail(GENERIC_FAILURE, 500);
  }
  if (existingRow && existingRow.auth_user_id === null) {
    return fail(
      "이 이메일로 미리 등록된 앱이 있습니다. Google 계정으로 로그인하면 등록된 앱이 계정에 바로 연결됩니다.",
      409,
    );
  }

  const createLink = () =>
    admin.auth.admin.generateLink({
      type: "signup",
      email: payload.email,
      password: randomPassword(),
    });

  const created = await admin.auth.admin.createUser({
    email: payload.email,
    password: randomPassword(),
  });
  if (created.error) {
    if (!isEmailTaken(created.error)) {
      console.error(
        "[auth/signup] createUser failed",
        created.error.code ?? created.error.message,
      );
      return fail(GENERIC_FAILURE, 500);
    }
    // 같은 주소의 로그인이 이미 있다. 인증된 계정이면 거절하고, 인증 전 계정이면 재사용한다.
    // 재사용하는 계정에는 누가 넣었는지 모르는 비밀번호가 있을 수 있으므로(공개 가입 API 로 만든 경우)
    // 임시 비밀번호로 덮어쓴다. 덮어쓰면 이전 링크가 무효가 되므로 링크는 그 뒤에 새로 받는다.
    const existing = await createLink();
    if (existing.error || !existing.data?.user) {
      if (isEmailTaken(existing.error)) return fail(ALREADY_REGISTERED, 409);
      console.error("[auth/signup] pending account lookup failed", existing.error?.code);
      return fail(GENERIC_FAILURE, 500);
    }
    if (existing.data.user.email_confirmed_at) return fail(ALREADY_REGISTERED, 409);

    const reset = await admin.auth.admin.updateUserById(existing.data.user.id, {
      password: randomPassword(),
    });
    if (reset.error) {
      console.error(
        "[auth/signup] pending account reset failed",
        reset.error.code ?? reset.error.message,
      );
      return fail(GENERIC_FAILURE, 500);
    }
  }

  const link = await createLink();
  if (link.error || !link.data?.properties?.hashed_token) {
    if (isEmailTaken(link.error)) return fail(ALREADY_REGISTERED, 409);
    console.error("[auth/signup] generateLink failed", link.error?.code ?? link.error?.message);
    return fail(GENERIC_FAILURE, 500);
  }

  // 인증 서버 주소(action_link)를 그대로 보내지 않는다 — 열기만 해도 인증이 확정되기 때문
  const tmpl = signupVerifyEmail({
    link: buildConfirmUrl(SITE_URL, link.data.properties.hashed_token),
  });
  const sent = await sendEmail({ to: payload.email, ...tmpl });
  if (!sent.ok) {
    // 인증 전 계정은 지우지 않는다 — 회원 행이 없고 임시 비밀번호뿐이라 남아도 해가 없고,
    // 같은 주소로 다시 가입하면 그대로 재사용된다. (로그인 삭제는 회원 행까지 지우는 cascade 가 걸려 있다.)
    console.error("[auth/signup] verification email failed", sent.reason);
    // 502 는 Cloudflare 가 본문을 자체 오류 페이지로 바꿔 안내 문구가 사라진다 — 500 으로 내린다
    return fail("인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }

  return NextResponse.json({ ok: true });
}
