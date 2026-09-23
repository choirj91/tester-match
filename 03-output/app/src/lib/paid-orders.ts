/**
 * 유료 테스터 주문 확정 (ADR-0011).
 *
 * 멱등성 계약 (CLAUDE.md — 결제 코드 필수):
 * - 같은 (paymentKey, orderId, amount) 로 몇 번을 불러도 결과 동일.
 * - 토스 승인 성공 후 DB 반영 전에 죽어도, 재호출 시
 *   ALREADY_PROCESSED_PAYMENT 를 성공으로 취급해 복구된다.
 * - payments.provider_tx_id unique + 주문 상태 조건부 UPDATE 가 이중 기록 차단.
 * - 알림 이메일은 pending → paid 전이가 실제로 일어난 호출에서만 발송.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { paidOrderAdminEmail, paidOrderReceiptEmail } from "@/lib/email-templates";
import { CONTACT_EMAIL } from "@/lib/site";
import { TOSS_ALREADY_PROCESSED, confirmTossPayment } from "@/lib/toss";

type OrderWithApp = {
  id: number;
  order_code: string;
  app_id: number;
  buyer_user_id: number;
  tester_count: number;
  amount_krw: number;
  status: string;
  apps: { name: string } | null;
};

export type ConfirmPaidOrderResult =
  | {
      ok: true;
      alreadyPaid: boolean;
      order: { orderCode: string; appName: string; testerCount: number; amountKrw: number };
    }
  | { ok: false; message: string };

export async function confirmPaidTesterOrder(args: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<ConfirmPaidOrderResult> {
  const supabase = createSupabaseAdminClient();

  // 1) 주문 조회 — orderId 는 우리 order_code
  const { data: order, error: orderErr } = await supabase
    .from("paid_tester_orders")
    .select(
      "id, order_code, app_id, buyer_user_id, tester_count, amount_krw, status, apps(name)",
    )
    .eq("order_code", args.orderId)
    .maybeSingle<OrderWithApp>();

  if (orderErr || !order) {
    console.error("[paid-orders] order not found", args.orderId, orderErr);
    return { ok: false, message: "주문을 찾을 수 없습니다." };
  }

  const summary = {
    orderCode: order.order_code,
    appName: order.apps?.name ?? `앱 #${order.app_id}`,
    testerCount: order.tester_count,
    amountKrw: order.amount_krw,
  };

  // 2) 상태 가드 — 이미 처리된 주문은 재호출 시 성공으로 응답 (멱등)
  if (order.status !== "pending") {
    if (["paid", "in_progress", "completed"].includes(order.status)) {
      return { ok: true, alreadyPaid: true, order: summary };
    }
    return { ok: false, message: "이미 취소되었거나 환불된 주문입니다." };
  }

  // 3) 금액 검증 — DB 의 주문 금액이 진실. 불일치면 토스 호출 자체를 막는다.
  if (args.amount !== order.amount_krw) {
    console.error(
      "[paid-orders] amount mismatch",
      order.order_code,
      { expected: order.amount_krw, got: args.amount },
    );
    return { ok: false, message: "결제 금액이 주문 금액과 일치하지 않습니다." };
  }

  // 4) 토스 승인
  const confirm = await confirmTossPayment(args);
  if (!confirm.ok && confirm.code !== TOSS_ALREADY_PROCESSED) {
    console.error("[paid-orders] toss confirm failed", order.order_code, confirm);
    return { ok: false, message: confirm.message };
  }

  const nowIso = new Date().toISOString();

  // 5) payments 기록 — provider_tx_id unique 로 중복 삽입 차단
  const { error: payInsertErr } = await supabase.from("payments").insert({
    user_id: order.buyer_user_id,
    provider: "toss",
    provider_tx_id: args.paymentKey,
    amount_krw: order.amount_krw,
    purpose: "paid_testers",
    ref_app_id: order.app_id,
    status: "completed",
    paid_at: nowIso,
  });
  if (payInsertErr && payInsertErr.code !== "23505") {
    console.error("[paid-orders] payments insert failed", payInsertErr);
    return { ok: false, message: "결제 기록 저장에 실패했습니다. 관리자에게 문의해주세요." };
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("provider_tx_id", args.paymentKey)
    .maybeSingle();

  // 6) 주문 전이 — status='pending' 조건이 동시 호출 경합을 정리한다
  const { data: transitioned, error: updateErr } = await supabase
    .from("paid_tester_orders")
    .update({
      status: "paid",
      payment_id: payment?.id ?? null,
      payment_key: args.paymentKey,
      paid_at: nowIso,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");

  if (updateErr) {
    console.error("[paid-orders] order update failed", updateErr);
    return { ok: false, message: "주문 상태 갱신에 실패했습니다. 관리자에게 문의해주세요." };
  }

  const didTransition = (transitioned ?? []).length > 0;

  // 7) 알림 — 실제 전이가 일어난 호출에서만, 실패해도 주문은 성공 처리
  if (didTransition) {
    await notifyPaidOrder(order, summary);
  }

  return { ok: true, alreadyPaid: !didTransition, order: summary };
}

async function notifyPaidOrder(
  order: OrderWithApp,
  summary: { orderCode: string; appName: string; testerCount: number; amountKrw: number },
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data: buyer } = await supabase
      .from("users")
      .select("email, nickname")
      .eq("id", order.buyer_user_id)
      .maybeSingle();

    const adminTmpl = paidOrderAdminEmail({
      ...summary,
      appId: order.app_id,
      buyerNickname: buyer?.nickname ?? `사용자 #${order.buyer_user_id}`,
      buyerEmail: buyer?.email ?? "-",
    });
    await sendEmail({ to: CONTACT_EMAIL, ...adminTmpl });

    if (buyer?.email && !buyer.email.endsWith("@deleted.local")) {
      const receiptTmpl = paidOrderReceiptEmail({
        buyerNickname: buyer.nickname,
        ...summary,
      });
      await sendEmail({ to: buyer.email, ...receiptTmpl });
    }
  } catch (err) {
    console.error("[paid-orders] notify failed", err);
  }
}
