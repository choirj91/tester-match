import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmPaidTesterOrder, type ConfirmPaidOrderResult } from "@/lib/paid-orders";

export const metadata = {
  title: "결제 완료",
  robots: { index: false, follow: false },
};

/** 크레딧 결제 주문 — 토스 confirm 없이 DB 상태만 보여준다 */
async function loadCreditsOrder(orderCode: string, userId: number): Promise<ConfirmPaidOrderResult> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("paid_tester_orders")
    .select("order_code, tester_count, amount_krw, status, buyer_user_id, apps(name)")
    .eq("order_code", orderCode)
    .maybeSingle<{
      order_code: string;
      tester_count: number;
      amount_krw: number;
      status: string;
      buyer_user_id: number;
      apps: { name: string } | null;
    }>();
  if (!data || data.buyer_user_id !== userId || !["paid", "in_progress", "completed"].includes(data.status)) {
    return { ok: false, message: "주문을 찾을 수 없습니다." };
  }
  return {
    ok: true,
    alreadyPaid: true,
    order: {
      orderCode: data.order_code,
      appName: data.apps?.name ?? "앱",
      testerCount: data.tester_count,
      amountKrw: data.amount_krw,
    },
  };
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string; credits?: string }>;
}) {
  const { paymentKey, orderId, amount, credits } = await searchParams;
  const user = await getCurrentUser();

  let result: ConfirmPaidOrderResult;
  if (credits === "1") {
    result =
      user && orderId
        ? await loadCreditsOrder(orderId, user.id)
        : { ok: false, message: "로그인이 필요합니다." };
  } else {
    const amountNumber = Number(amount);
    const valid =
      typeof paymentKey === "string" &&
      paymentKey.length > 0 &&
      typeof orderId === "string" &&
      orderId.length > 0 &&
      Number.isInteger(amountNumber) &&
      amountNumber > 0;
    result = valid
      ? await confirmPaidTesterOrder({ paymentKey, orderId, amount: amountNumber })
      : { ok: false, message: "결제 정보가 올바르지 않습니다." };
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        {result.ok ? (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">시트가 열렸습니다</h1>
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-left text-sm">
              <p className="font-semibold text-neutral-900">{result.order.appName}</p>
              <p className="mt-2 text-neutral-600">
                유료 시트 {result.order.testerCount}명 ·{" "}
                {result.order.amountKrw.toLocaleString("ko-KR")}
                {credits === "1" ? " 크레딧" : "원"}
              </p>
              <p className="mt-1 text-xs text-neutral-400">주문번호 {result.order.orderCode}</p>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-neutral-600">
              앱이 급구 상단에 노출되고 전 회원에게 알림이 발송되었습니다. 테스터가 시트를 채우면
              콘솔에서 매일 스크린샷 증빙을 확인할 수 있습니다.
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
            href="/console"
            className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-trust-700"
          >
            콘솔에서 보기
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
