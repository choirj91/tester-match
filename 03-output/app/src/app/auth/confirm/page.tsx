import Link from "next/link";
import { cookies } from "next/headers";
import { CONFIRM_COOKIE, isValidTokenHash } from "@/lib/signup-confirm";
import {
  KAKAO_NICKNAME_MAX,
  NICKNAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  type CompleteSignupError,
} from "@/lib/validators/signup";
import { ConfirmForm } from "./confirm-form";

export const runtime = "edge";
export const metadata = {
  title: "가입 완료하기",
  robots: { index: false, follow: false },
};

const ERROR_MESSAGE: Record<CompleteSignupError, string> = {
  nickname: `닉네임을 ${NICKNAME_MAX}자 이하로 입력해주세요.`,
  kakao: `카카오톡 닉네임을 ${KAKAO_NICKNAME_MAX}자 이하로 입력해주세요.`,
  weak: `비밀번호는 ${PASSWORD_MIN}자 이상 ${PASSWORD_MAX}자 이하로 입력해주세요.`,
  mismatch: "두 칸의 비밀번호가 서로 다릅니다. 다시 입력해주세요.",
  agree: "이용약관과 개인정보처리방침에 동의해주세요.",
};

function errorMessage(code: string | undefined): string | null {
  return code && code in ERROR_MESSAGE ? ERROR_MESSAGE[code as CompleteSignupError] : null;
}

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const hasToken = isValidTokenHash(cookieStore.get(CONFIRM_COOKIE)?.value);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-trust-600 hover:text-trust-700 text-sm font-bold tracking-tight"
        >
          ← Tester Match
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-neutral-900">가입 완료하기</h1>

        {hasToken ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              이메일이 확인되었습니다. 닉네임과 로그인에 쓸 비밀번호를 정하면 가입이 완료됩니다.
              본인이 가입을 신청하지 않았다면 아무것도 입력하지 말고 이 창을 닫아주세요.
            </p>
            <ConfirmForm serverError={errorMessage(error)} />
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              인증 정보를 찾지 못했습니다. 메일의 [이메일 인증하기] 버튼을 같은 브라우저에서 다시
              눌러주세요. 이미 가입을 마쳤다면 바로 로그인할 수 있습니다.
            </p>
            <Link
              href="/auth/login"
              className="bg-trust-600 hover:bg-trust-700 mt-8 block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold text-white shadow-sm"
            >
              로그인으로 이동
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
