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
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/inquiries" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 내 문의
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-neutral-900">문의하기</h1>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          문의 내용은 본인과 운영팀만 볼 수 있습니다. 답변이 등록되면 사이트 알림과 가입 이메일로
          알려드립니다.
        </p>
        <InquiryForm />
      </main>
    </>
  );
}
