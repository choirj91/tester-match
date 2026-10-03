import Link from "next/link";
import { GoogleSignInButton } from "./google-sign-in-button";
import { EmailSignInForm } from "./email-sign-in-form";
import { isEmailSignupEnabled } from "@/lib/validators/signup";

export const runtime = "edge";
export const metadata = { title: "로그인" };

const NOTICE: Record<string, string> = {
  verified: "이메일 인증이 완료되었습니다. 이메일과 비밀번호로 로그인해주세요.",
  exchange_failed:
    "로그인 링크를 확인하지 못했습니다. 이메일로 가입했다면 이메일과 비밀번호로 로그인해주세요.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verified?: string; error?: string }>;
}) {
  const { verified, error } = await searchParams;
  const notice = verified === "1" ? NOTICE.verified : error ? NOTICE[error] : null;
  const signupEnabled = isEmailSignupEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-trust-600 hover:text-trust-700"
        >
          ← Tester Match
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-neutral-900">로그인</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Google 계정으로 30초 안에 시작합니다. 이메일과 기본 프로필만 사용합니다.
        </p>

        {notice && (
          <p className="mt-4 rounded-lg bg-trust-50 px-3 py-2 text-sm text-trust-700">{notice}</p>
        )}

        <div className="mt-8">
          <GoogleSignInButton />
        </div>

        <div className="my-6 flex items-center gap-3 text-xs text-neutral-400">
          <span className="h-px flex-1 bg-neutral-200" />
          또는
          <span className="h-px flex-1 bg-neutral-200" />
        </div>

        <EmailSignInForm />

        {signupEnabled && (
          <p className="mt-4 text-center text-sm text-neutral-600">
            계정이 없나요?{" "}
            <Link href="/auth/signup" className="font-semibold text-trust-600 hover:underline">
              이메일로 회원가입
            </Link>
          </p>
        )}

        <p className="mt-6 text-xs leading-relaxed text-neutral-500">
          계속 진행하면{" "}
          <Link href="/policies/terms" className="underline hover:text-neutral-900">
            이용약관
          </Link>
          과{" "}
          <Link href="/policies/privacy" className="underline hover:text-neutral-900">
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주합니다.
        </p>
      </div>
    </main>
  );
}
