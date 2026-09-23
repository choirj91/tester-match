import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { confirmPaidTesterOrder } from "@/lib/paid-orders";

export const runtime = "edge";
export const metadata = {
  title: "결제 완료",
  robots: { index: false, follow: false },
};

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }>;
}) {
  const { paymentKey, orderId, amount } = await searchParams;
  const user = await getCurrentUser();

  const amountNumber = Number(amount);
  const valid =
    typeof paymentKey === "string" &&
    paymentKey.length > 0 &&
    typeof orderId === "string" &&
    orderId.length > 0 &&
    Number.isInteger(amountNumber) &&
    amountNumber > 0;

  const result = valid
    ? await confirmPaidTesterOrder({ paymentKey, orderId, amount: amountNumber })
    : ({ ok: false, message: "결제 정보가 올바르지 않습니다." } as const);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        {result.ok ? (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">결제가 완료되었습니다</h1>
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-left text-sm">
              <p className="font-semibold text-neutral-900">{result.order.appName}</p>
              <p className="mt-2 text-neutral-600">
                유료 테스터 {result.order.testerCount}명 ·{" "}
                {result.order.amountKrw.toLocaleString("ko-KR")}원
              </p>
              <p className="mt-1 text-xs text-neutral-400">주문번호 {result.order.orderCode}</p>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-neutral-600">
              운영팀이 확인 후 곧 테스트를 시작합니다. 진행 상황은 앱 상세의 테스터
              모니터링에서 확인할 수 있고, 신청 완료 메일도 함께 발송되었습니다.
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">결제 확인에 실패했습니다</h1>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">{result.message}</p>
            <p className="mt-2 text-xs text-neutral-400">
              카드 승인 후 문제가 생긴 경우 자동으로 복구됩니다 — 같은 화면을 새로고침하거나
              문의해주세요.
            </p>
          </>
        )}
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/paid-testers"
            className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-trust-700"
          >
            주문 현황 보기
          </Link>
          <Link
            href="/apps"
            className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:border-trust-500"
          >
            내 앱으로
          </Link>
        </div>
      </main>
    </>
  );
}
