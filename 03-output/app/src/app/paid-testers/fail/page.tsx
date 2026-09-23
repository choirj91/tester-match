import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";
export const metadata = {
  title: "결제 실패",
  robots: { index: false, follow: false },
};

export default async function PaymentFailPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; message?: string }>;
}) {
  const { code, message } = await searchParams;
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-4xl">❌</p>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">결제가 완료되지 않았습니다</h1>
        <p className="mt-4 text-sm leading-relaxed text-neutral-600">
          {message ?? "결제가 취소되었거나 실패했습니다."}
        </p>
        {code && <p className="mt-1 text-xs text-neutral-400">오류 코드: {code}</p>}
        <p className="mt-4 text-sm text-neutral-600">
          결제 금액은 청구되지 않았습니다. 다시 시도해주세요.
        </p>
        <div className="mt-8">
          <Link
            href="/paid-testers"
            className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-trust-700"
          >
            다시 신청하기
          </Link>
        </div>
      </main>
    </>
  );
}
