import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { paidTesterOrderName } from "@/lib/paid-testers";
import { CheckoutWidget } from "./checkout-widget";

export const runtime = "edge";
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
  if (!orderCode) {
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

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
  const appName = order.apps?.name ?? "앱";

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">결제</h1>
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
          <p className="font-semibold text-neutral-900">
            {appName} — 유료 테스터 {order.tester_count}명 (14일)
          </p>
          <p className="mt-1 text-neutral-600">
            결제 금액 <strong>{order.amount_krw.toLocaleString("ko-KR")}원</strong>
          </p>
        </div>

        {clientKey ? (
          <CheckoutWidget
            clientKey={clientKey}
            customerKey={`tm_user_${user.id}`}
            orderCode={order.order_code}
            orderName={paidTesterOrderName(appName, order.tester_count)}
            amount={order.amount_krw}
            customerEmail={user.email}
            customerName={user.nickname}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm leading-relaxed text-amber-900">
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
