import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmPaidTesterOrder, type ConfirmPaidOrderResult } from "@/lib/paid-orders";
import { extractPaidOrderCode } from "@/lib/paid-testers";
import { paymentResultView } from "./view";

export const metadata = {
  title: "결제 완료",
  robots: { index: false, follow: false },
};

/** 크레딧 결제 주문 — 카드 결제 확인 없이 DB 상태만 보여준다 */
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
    return { ok: false, reason: "not_found", message: "주문을 찾을 수 없습니다." };
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

/** 로그인한 사용자가 이 주문의 구매자인지 — 주문 내용·실패 사유를 보여줄지 정한다 */
async function isOrderBuyer(orderCode: string, userId: number): Promise<boolean> {
  const { data } = await createSupabaseAdminClient()
    .from("paid_tester_orders")
    .select("buyer_user_id")
    .eq("order_code", orderCode)
    .maybeSingle<{ buyer_user_id: number }>();
  return data?.buyer_user_id === userId;
}

type SearchParams = {
  /** 우리가 붙이는 주문 코드 (PC 결제 완료 후 이동, 크레딧 결제) */
  orderId?: string;
  /** 포트원이 리디렉션(모바일)에 붙이는 결제 ID — 주문 코드와 같은 값 */
  paymentId?: string;
  /** 포트원 리디렉션: 결제창이 실패·취소로 끝났을 때만 온다. 함께 오는 message 는 읽지 않는다 (외부 입력) */
  code?: string;
  credits?: string;
};

/** orderId·paymentId 중 온 것에서 주문 코드를 고른다. 둘 다 왔는데 서로 다르면 null */
function pickOrderCode(orderId: unknown, paymentId: unknown): string | null {
  const fromOrderId = extractPaidOrderCode(orderId);
  const fromPaymentId = extractPaidOrderCode(paymentId);
  if (fromOrderId && fromPaymentId && fromOrderId !== fromPaymentId) return null;
  return fromOrderId ?? fromPaymentId;
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { orderId, paymentId, code, credits } = await searchParams;
  const user = await getCurrentUser();
  const orderCode = pickOrderCode(orderId, paymentId);
  const isCredits = credits === "1";

  let result: ConfirmPaidOrderResult;
  let viewerIsBuyer: boolean;
  if (isCredits) {
    result =
      user && orderId
        ? await loadCreditsOrder(orderId, user.id)
        : { ok: false, reason: "retry", message: "로그인이 필요합니다." };
    // loadCreditsOrder 는 구매자 본인일 때만 주문을 돌려준다 (실패 문구는 고정)
    viewerIsBuyer = true;
  } else {
    // 결제 여부·금액은 URL 이 아니라 서버가 포트원에 조회해 확인한다 (주문 코드만 넘긴다).
    // 로그인 여부와 무관하게, 결제창이 실패 코드를 돌려줬어도 확정을 시도한다 — PG 는 승인했을 수 있다.
    result = orderCode
      ? await confirmPaidTesterOrder({ orderId: orderCode })
      : { ok: false, reason: "not_found", message: "결제 정보가 올바르지 않습니다." };
    viewerIsBuyer = Boolean(user && orderCode && (await isOrderBuyer(orderCode, user.id)));
  }
  const view = paymentResultView({
    result,
    viewerIsBuyer,
    windowCode: isCredits ? undefined : code,
    orderCode,
  });

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-lg px-6 py-16 text-center">
        {view.kind === "success" && view.order && (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">시트가 열렸습니다</h1>
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-left text-sm">
              <p className="font-semibold text-neutral-900">{view.order.appName}</p>
              <p className="mt-2 text-neutral-600">
                유료 시트 {view.order.testerCount}명 ·{" "}
                {view.order.amountKrw.toLocaleString("ko-KR")}
                {isCredits ? " 크레딧" : "원"}
              </p>
              <p className="mt-1 text-xs text-neutral-400">주문번호 {view.order.orderCode}</p>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-neutral-600">
              앱이 급구 상단에 노출되고 전 회원에게 알림이 발송되었습니다. 테스터가 시트를 채우면
              콘솔에서 매일 스크린샷 증빙을 확인할 수 있습니다.
            </p>
          </>
        )}
        {view.kind === "success" && !view.order && (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">결제가 확인되었습니다</h1>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              주문 내용은 구매한 계정으로 로그인한 뒤 콘솔에서 확인할 수 있습니다.
            </p>
          </>
        )}
        {view.kind === "failure" && (
          <>
            <p className="text-4xl">⚠️</p>
            <h1 className="mt-4 text-2xl font-bold text-neutral-900">{view.title}</h1>
            <p className="mt-4 text-sm leading-relaxed text-neutral-600">{view.message}</p>
            {view.code && <p className="mt-1 text-xs text-neutral-400">오류 코드: {view.code}</p>}
            {view.retryOrderCode && (
              <p className="mt-4 text-sm">
                <Link
                  href={`/paid-testers/checkout?order=${view.retryOrderCode}`}
                  className="font-semibold text-trust-600 underline underline-offset-2"
                >
                  다시 결제하기
                </Link>
              </p>
            )}
            {view.showRecoveryHint && (
              <p className="mt-2 text-xs text-neutral-400">
                카드 승인 후 문제가 생긴 경우 자동으로 복구됩니다 — 같은 화면을 새로고침하거나
                문의해주세요.
              </p>
            )}
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
