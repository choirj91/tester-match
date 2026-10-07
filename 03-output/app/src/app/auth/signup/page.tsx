import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { isEmailSignupEnabled } from "@/lib/validators/signup";
import { AuthCard } from "../auth-card";
import { SignupForm } from "./signup-form";

export const metadata = { title: "회원가입", robots: { index: false, follow: true } };

const LINK = "font-semibold text-ink-900 underline underline-offset-2 hover:text-accent-600";

export default function SignupPage() {
  const enabled = isEmailSignupEnabled();
  return (
    <AuthCard title="이메일로 회원가입">
      <p className="m-0 mt-2 text-sm leading-relaxed text-ink-700">
        이메일 주소로 가입 링크를 보내드립니다. 링크에서 닉네임과 비밀번호를 정하면 가입이
        완료됩니다. 테스터로 참여하려면 Play
        스토어에서 쓰는 Google 계정이 필요하니,{" "}
        <Link href="/auth/login" className={LINK}>
          Google 로그인
        </Link>
        도 이용할 수 있습니다.
      </p>

      {enabled ? (
        <SignupForm />
      ) : (
        <Notice kind="caution" className="mt-7">
          이메일 회원가입은 준비 중입니다. 지금은{" "}
          <Link href="/auth/login" className={LINK}>
            Google 계정으로 시작
          </Link>
          해주세요.
        </Notice>
      )}
    </AuthCard>
  );
}
