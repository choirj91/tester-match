import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { InquiryForm } from "./inquiry-form";

export const metadata = { title: "문의하기", robots: { index: false, follow: false } };

export default async function NewInquiryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/inquiries/new");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-5 pt-12 pb-[88px]">
        <Link href="/inquiries" className="inline-flex min-h-11 items-center text-sm text-ink-700 hover:text-accent-600">
          ← 내 문의
        </Link>
        <h1 className="mt-2 font-display text-h1 font-semibold text-ink-900">문의하기</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
          문의 내용은 본인과 운영팀만 볼 수 있습니다. 답변이 등록되면 사이트 알림과 가입 이메일로
          알려드립니다.
        </p>
        <InquiryForm />
      </main>
    </>
  );
}
