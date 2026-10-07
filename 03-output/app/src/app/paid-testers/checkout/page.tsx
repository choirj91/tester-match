import Link from "next/link";
import { redirect } from "next/navigation";
import { FeeBreakdown } from "@/components/fee-breakdown";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKrw } from "@/lib/credits";
import {
  PAID_TESTER_PRICE_KRW,
  canOrderPaidTesters,
  paidTesterOrderName,
} from "@/lib/paid-testers";
import { PayButton } from "./pay-button";

export const metadata = {
  title: "결제",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderCode } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/auth/login?next=/paid-testers`);
  }
  if (!orderCode || !canOrderPaidTesters(user)) {
    redirect("/paid-testers");
  }

  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("id, order_code, buyer_user_id, tester_count, amount_krw, status, apps(name)")
    .eq("order_code", orderCode)
    .maybeSingle<{
      id: number;
      order_code: string;
      buyer_user_id: number;
      tester_count: number;
      amount_krw: number;
      status: string;
      apps: { name: string } | null;
    }>();

  if (!order || order.buyer_user_id !== user.id) {
    redirect("/paid-testers");
  }
  if (order.status !== "pending") {
    redirect("/paid-testers");
  }

  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? "";
  const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY ?? "";
  const appName = order.apps?.name ?? "앱";

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-bold text-ink-900">결제</h1>
        <div className="mt-4 border border-ink-200 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-ink-900">
            {appName} — 유료 테스터 {order.tester_count}명 (14일)
          </p>
          <p className="mt-1 text-ink-700">
            {order.tester_count}명 × {formatKrw(PAID_TESTER_PRICE_KRW)}원 = 결제 금액{" "}
            <strong>{formatKrw(order.amount_krw)}원</strong> (부가세 포함)
          </p>
          <p className="mt-1 text-xs text-ink-600">
            판매자 낰낰컴퍼니 · 신용·체크카드 (KG이니시스) · 주문번호 {order.order_code}
          </p>
        </div>

        <FeeBreakdown className="mt-4" />
        <p className="mt-2 text-xs text-ink-600">
          환불 기준 전체는{" "}
          <Link href="/policies/refund" className="underline underline-offset-2">
            환불 정책
          </Link>
          을 따릅니다.
        </p>

        {storeId && channelKey ? (
          <PayButton
            storeId={storeId}
            channelKey={channelKey}
            orderCode={order.order_code}
            orderName={paidTesterOrderName(appName, order.tester_count)}
            amount={order.amount_krw}
            customerEmail={user.email}
            customerName={user.nickname}
          />
        ) : (
          <div className="mt-6 border border-warning-700 bg-warning-50 p-5 text-sm leading-relaxed text-warning-700">
            결제 수단 연동이 아직 완료되지 않았습니다. 잠시 후 다시 시도하시거나{" "}
            <Link href="/paid-testers" className="underline underline-offset-2">
              유료 테스터 페이지
            </Link>
            에서 문의해주세요.
          </div>
        )}
      </main>
    </>
  );
}
