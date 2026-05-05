import Link from "next/link";
import { GoogleSignInButton } from "./google-sign-in-button";

export const metadata = { title: "로그인" };

export default function LoginPage() {
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

        <div className="mt-8">
          <GoogleSignInButton />
        </div>

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
