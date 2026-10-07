import { CircleCheck, TriangleAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmPaidTesterOrder, type ConfirmPaidOrderResult } from "@/lib/paid-orders";
import { PAID_SEAT_BOOST_DAYS, PAID_SEAT_FILL_DAYS } from "@/lib/paid-seats";
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

/**
 * 시트를 열지 않은 주문인지 — 심사·시험용 주문은 결제 전부터 seats_closed 라 급구·전 회원 알림이 없다.
 * 조회 실패는 false(일반 주문 문구)로 둔다.
 */
async function isSeatsClosedOrder(orderCode: string): Promise<boolean> {
  const { data } = await createSupabaseAdminClient()
    .from("paid_tester_orders")
    .select("seats_closed")
    .eq("order_code", orderCode)
    .maybeSingle<{ seats_closed: boolean }>();
  return data?.seats_closed === true;
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
  const seatsClosed =
    view.kind === "success" && view.order ? await isSeatsClosedOrder(view.order.orderCode) : false;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto flex max-w-lg flex-col gap-6 px-5 py-16">
        {view.kind === "success" && view.order && (
          <>
            <div className="flex flex-col items-center gap-4 text-center">
              <CircleCheck className="size-8 text-success-700" strokeWidth={1.7} aria-hidden="true" />
              <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">
                {seatsClosed ? "결제가 완료되었습니다" : "시트가 열렸습니다"}
              </h1>
            </div>
            <Receipt title={view.order.appName} meta={`주문번호 ${view.order.orderCode}`}>
              <ReceiptDivider />
              <ReceiptRows>
                <ReceiptRow
                  strong
                  label={`유료 시트 ${view.order.testerCount}명`}
                  value={`${view.order.amountKrw.toLocaleString("ko-KR")}${isCredits ? " 크레딧" : "원"}`}
                />
              </ReceiptRows>
            </Receipt>
            {!seatsClosed && (
              <Notice>
                <span className="font-mono tabular-nums">
                  충원 기간 결제 후 {PAID_SEAT_FILL_DAYS}일 · 급구 표시 {PAID_SEAT_BOOST_DAYS}일
                </span>
              </Notice>
            )}
            <p className="m-0 text-center text-sm leading-relaxed text-ink-700">
              {seatsClosed
                ? "심사·시험용 주문이라 시트를 열지 않았습니다. 급구 표시와 전 회원 알림은 실제 주문에서만 나갑니다."
                : "앱이 급구 상단에 노출되고 전 회원에게 알림이 발송되었습니다. 테스터가 시트를 채우면 콘솔에서 매일 스크린샷 증빙을 확인할 수 있습니다."}
            </p>
          </>
        )}
        {view.kind === "success" && !view.order && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CircleCheck className="size-8 text-success-700" strokeWidth={1.7} aria-hidden="true" />
            <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">결제가 확인되었습니다</h1>
            <p className="m-0 text-sm leading-relaxed text-ink-700">
              주문 내용은 구매한 계정으로 로그인한 뒤 콘솔에서 확인할 수 있습니다.
            </p>
          </div>
        )}
        {view.kind === "failure" && (
          <div role="alert" className="flex flex-col items-center gap-4 text-center">
            <TriangleAlert className="size-8 text-danger-700" strokeWidth={1.7} aria-hidden="true" />
            <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">{view.title}</h1>
            <p className="m-0 text-sm leading-relaxed text-ink-700">{view.message}</p>
            {view.code && <p className="m-0 font-mono text-xs text-ink-600">오류 코드: {view.code}</p>}
            {view.retryOrderCode && (
              <ButtonLink variant="text" href={`/paid-testers/checkout?order=${view.retryOrderCode}`}>
                다시 결제하기
              </ButtonLink>
            )}
            {view.showRecoveryHint && (
              <p className="m-0 text-xs text-ink-600">
                카드 승인 후 문제가 생긴 경우 자동으로 복구됩니다 — 같은 화면을 새로고침하거나
                문의해주세요.
              </p>
            )}
          </div>
        )}
        <div className="flex flex-col justify-center gap-3 pt-2 min-[481px]:flex-row">
          <ButtonLink href="/console">콘솔에서 보기</ButtonLink>
          <ButtonLink href="/apps" variant="secondary">
            내 앱으로
          </ButtonLink>
        </div>
      </main>
    </>
  );
}
