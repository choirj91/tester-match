import Link from "next/link";
import { redirect } from "next/navigation";
import { FeeBreakdown } from "@/components/fee-breakdown";
import { SiteHeader } from "@/components/site-header";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatKrw } from "@/lib/credits";
import {
  PAID_TESTER_PRICE_KRW,
  canOrderPaidTesters,
  paidTesterOrderName,
} from "@/lib/paid-testers";
import { SEAT_TOTAL_DAYS } from "@/lib/seat-reward-rules";
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
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-12">
        <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">결제</h1>
        <Receipt
          title={`${appName} — 유료 테스터 ${order.tester_count}명 (${SEAT_TOTAL_DAYS}일)`}
          meta={`판매자 낰낰컴퍼니 · 신용·체크카드 (KG이니시스) · 주문번호 ${order.order_code}`}
          footer={
            <>
              환불 기준 전체는{" "}
              <Link href="/policies/refund" className="text-ink-900 underline hover:text-accent-600">
                환불 정책
              </Link>
              을 따릅니다.
            </>
          }
        >
          <ReceiptDivider />
          <ReceiptRows>
            <ReceiptRow
              label={`${order.tester_count}명 × ${formatKrw(PAID_TESTER_PRICE_KRW)}원`}
              value={`${formatKrw(order.amount_krw)}원`}
            />
          </ReceiptRows>
          <ReceiptDivider />
          <ReceiptRows>
            <ReceiptRow strong label="결제 금액 (부가세 포함)" value={`${formatKrw(order.amount_krw)}원`} />
          </ReceiptRows>
        </Receipt>

        <FeeBreakdown />

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
          <Notice kind="caution">
            결제 수단 연동이 아직 완료되지 않았습니다. 잠시 후 다시 시도하시거나{" "}
            <Link href="/paid-testers" className="text-ink-900 underline hover:text-accent-600">
              유료 테스터 페이지
            </Link>
            에서 문의해주세요.
          </Notice>
        )}
      </main>
    </>
  );
}
