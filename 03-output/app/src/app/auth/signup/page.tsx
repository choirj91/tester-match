import Link from "next/link";
import { isEmailSignupEnabled } from "@/lib/validators/signup";
import { SignupForm } from "./signup-form";

export const runtime = "edge";
export const metadata = { title: "회원가입", robots: { index: false, follow: true } };

export default function SignupPage() {
  const enabled = isEmailSignupEnabled();
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight text-trust-600 hover:text-trust-700"
        >
          ← Tester Match
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-neutral-900">이메일로 회원가입</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          이메일 주소로 가입 링크를 보내드립니다. 링크에서 닉네임과 비밀번호를 정하면 가입이
          완료됩니다. 테스터로 참여하려면 Play
          스토어에서 쓰는 Google 계정이 필요하니,{" "}
          <Link href="/auth/login" className="font-semibold text-trust-600 hover:underline">
            Google 로그인
          </Link>
          도 이용할 수 있습니다.
        </p>

        {enabled ? (
          <SignupForm />
        ) : (
          <div className="mt-8 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
            이메일 회원가입은 준비 중입니다. 지금은{" "}
            <Link href="/auth/login" className="font-semibold underline">
              Google 계정으로 시작
            </Link>
            해주세요.
          </div>
        )}
      </div>
    </main>
  );
}
