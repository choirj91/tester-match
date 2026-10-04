/**
 * 유료 테스터 주문 확정 (ADR-0011) — 포트원 V2 결제 조회 기반.
 *
 * 포트원에는 서버 승인(confirm) 단계가 없다. PG 승인은 결제창 안에서 끝나므로, 여기서는
 * 결제 ID(= 주문 코드)로 결제를 조회해 상태(PAID)와 금액을 주문과 대조한 뒤 DB 에 반영만 한다.
 *
 * 멱등성 계약 (CLAUDE.md — 결제 코드 필수):
 * - 입력은 주문 코드 하나. 결제 여부·금액은 호출자가 아니라 포트원 조회 결과에서만 읽는다
 *   → 같은 주문 코드로 몇 번을 불러도(성공 화면 새로고침, 스윕 복구와 동시 실행 포함) 결과 동일.
 * - 결제 완료 후 DB 반영 전에 죽어도, 재호출·스윕이 같은 조회 결과로 이어서 반영한다.
 * - payments.provider_tx_id = 포트원 결제 ID(= 주문 코드, 주문당 하나) unique + 주문 상태 조건부 UPDATE 가
 *   이중 기록 차단. 포트원 거래 ID 는 주문의 payment_key 에 참고용으로만 남긴다.
 * - 시트 오픈·알림 이메일은 pending → paid 전이가 실제로 일어난 호출에서만.
 * - 전이가 0행이면 주문을 다시 읽는다 — 다른 호출이 확정했을 때만 성공, 그 사이 취소됐으면 성공이라 하지 않는다.
 * - "이 주문의 결제 완료"는 상태 PAID + 금액·통화(KRW)·결제 채널(우리 채널 키) 일치 (checkPaidPayment — 스윕과 공용).
 * - 조회 실패는 "결제 없음"으로 읽지 않는다 — 아무것도 쓰지 않고 다시 시도할 수 있는 실패로 답한다.
 * - 확정할 수 없는 결제(취소된 주문에 들어온 결제, 금액·통화·채널이 주문과 다른 결제)는 "확인 필요" 메모만 남긴다.
 *   이미 남긴 메모는 다시 쓰지 않는다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { paidOrderAdminEmail, paidOrderReceiptEmail } from "@/lib/email-templates";
import { CONTACT_EMAIL } from "@/lib/site";
import {
  PORTONE_PAID_STATUS,
  expectedPortOnePayment,
  lookupPortOnePayment,
  type PortOneLookup,
  type PortOnePayment,
} from "@/lib/portone";
import { appendLedger } from "@/lib/credits";
import {
  checkPaidPayment,
  hasPaidAfterCancelNote,
  hasPaymentMismatchNote,
  isRetryablePaymentStatus,
  paidAfterCancelNote,
  paymentMismatchNote,
} from "@/lib/paid-order-sweep-rules";
import { activatePaidOrder } from "@/lib/paid-seats";
import { newPaidOrderCode, paidTesterAmountKrw } from "@/lib/paid-testers";

type OrderWithApp = {
  id: number;
  order_code: string;
  app_id: number;
  buyer_user_id: number;
  tester_count: number;
  amount_krw: number;
  status: string;
  seats_closed?: boolean;
  paid_at?: string | null;
  admin_note?: string | null;
  apps: { name: string } | null;
};

/**
 * 확정 실패 사유 — 호출부(성공 화면·결제 전 확인·관리자 취소)가 다음 행동을 고르는 데 쓴다.
 *  not_paid: 결제가 없다 (다시 결제 가능) / retry: 지금은 판단할 수 없다 (다시 시도)
 *  payment_unsettled: 결제가 끝나지 않은 상태로 걸려 있다 (승인·입금 대기, 부분 취소 등 — 다시 결제하면 안 된다)
 *  closed: 취소·환불된 주문 / needs_review: 결제는 됐으나 주문과 맞지 않아 운영자 확인 대기
 */
export type ConfirmFailureReason =
  | "not_found"
  | "not_paid"
  | "payment_unsettled"
  | "retry"
  | "closed"
  | "needs_review";

export type ConfirmPaidOrderResult =
  | {
      ok: true;
      alreadyPaid: boolean;
      order: { orderCode: string; appName: string; testerCount: number; amountKrw: number };
    }
  | { ok: false; reason: ConfirmFailureReason; message: string };

type ConfirmFailure = Extract<ConfirmPaidOrderResult, { ok: false }>;

const fail = (reason: ConfirmFailureReason, message: string): ConfirmFailure => ({
  ok: false,
  reason,
  message,
});

const CONFIRMED_ORDER_STATUSES = ["paid", "in_progress", "completed"];
const CLOSED_ORDER_MESSAGE = "이미 취소되었거나 환불된 주문입니다.";
const LOOKUP_FAILED_MESSAGE =
  "결제 확인에 일시적으로 실패했습니다. 잠시 후 이 화면을 새로고침해주세요.";
const RETRY_MESSAGE = "주문 상태를 확인하지 못했습니다. 잠시 후 이 화면을 새로고침해주세요.";

type PaymentCheck =
  | { kind: "paid"; payment: PortOnePayment }
  | { kind: "mismatch"; reason: string }
  | { kind: "rejected"; failure: ConfirmFailure };

/** 포트원 조회 결과가 이 주문의 결제 완료인지 — 판정 기준은 checkPaidPayment (스윕과 공용). DB 의 주문 금액이 진실. */
function checkPayment(lookup: PortOneLookup, order: OrderWithApp): PaymentCheck {
  if (lookup.kind === "error") return { kind: "rejected", failure: fail("retry", LOOKUP_FAILED_MESSAGE) };
  const notPaid = fail("not_paid", "결제가 완료되지 않았습니다. 결제를 다시 진행해주세요.");
  if (lookup.kind === "not_found") return { kind: "rejected", failure: notPaid };

  const check = checkPaidPayment(lookup.payment, expectedPortOnePayment(order.amount_krw));
  if (check.kind === "paid") return { kind: "paid", payment: lookup.payment };
  if (check.kind === "mismatch") return { kind: "mismatch", reason: check.reason };
  if (check.kind === "unverifiable") {
    // 설정이 빠진 상태 — 결제를 확정도 부정도 하지 않는다
    console.error("[paid-orders] cannot verify payment", order.order_code, check.reason);
    return { kind: "rejected", failure: fail("retry", LOOKUP_FAILED_MESSAGE) };
  }
  // 결제창만 열렸거나 실패한 결제는 다시 결제할 수 있다. 그 외 미완료 상태는 돈이 걸려 있을 수 있다
  if (isRetryablePaymentStatus(lookup.payment.status)) return { kind: "rejected", failure: notPaid };
  console.error("[paid-orders] payment not settled", order.order_code, lookup.payment.status);
  return {
    kind: "rejected",
    failure: fail(
      "payment_unsettled",
      "이전 결제 시도를 확인하고 있습니다. 잠시 후 다시 확인해주시고, 계속되면 문의해주세요.",
    ),
  };
}

/** 확정할 수 없는 결제를 "확인 필요" 메모로 남긴다. 읽은 상태 그대로일 때만 쓴다. 기록 성공 여부를 돌려준다. */
async function writeAttentionNote(
  supabase: SupabaseClient,
  order: OrderWithApp,
  note: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("paid_tester_orders")
    .update({ admin_note: note })
    .eq("id", order.id)
    .eq("status", order.status);
  if (error) console.error("[paid-orders] attention note write failed", order.order_code, error);
  return !error;
}

/**
 * 미결제 주문에 결제는 됐는데 금액·통화·채널이 주문과 다름 — 확정하지 않는다 (주문은 pending 그대로).
 * 메모를 바로 남겨 일일 리포트에 올린다. 이미 남긴 메모는 다시 쓰지 않는다 (새로고침 멱등).
 * 메모를 남기지 못했으면 운영자가 알 수 없으므로 "확인해 드린다"고 하지 않고 다시 시도하게 한다.
 */
async function flagPaymentMismatch(
  supabase: SupabaseClient,
  order: OrderWithApp,
  reason: string,
): Promise<ConfirmPaidOrderResult> {
  if (!hasPaymentMismatchNote(order.admin_note)) {
    console.error("[paid-orders] payment does not match the order", order.order_code, reason);
    const note = paymentMismatchNote(reason, order.admin_note ?? null);
    if (!(await writeAttentionNote(supabase, order, note))) return fail("retry", RETRY_MESSAGE);
  }
  return fail(
    "needs_review",
    "결제 정보(금액·통화·결제 채널)가 주문과 달라 주문을 확정하지 못했습니다. 운영자가 확인한 뒤 처리해 드립니다.",
  );
}

/**
 * 취소된(결제 기록 없는) 주문에 결제가 들어와 있음 — 확정하지 않고 전액 환불 대상으로 올린다.
 * 이미 남긴 메모는 다시 쓰지 않는다 (새로고침 멱등). 동시에 불려도 같은 내용으로 덮어쓸 뿐이다.
 * 메모를 남기지 못했으면 "환불해 드린다"고 하지 않고 다시 시도하게 한다.
 */
async function flagPaidAfterCancel(
  supabase: SupabaseClient,
  order: OrderWithApp,
  paidKrw: number,
): Promise<ConfirmPaidOrderResult> {
  if (!hasPaidAfterCancelNote(order.admin_note)) {
    console.error("[paid-orders] payment found on a canceled order", order.order_code);
    const note = paidAfterCancelNote(paidKrw, order.admin_note ?? null);
    if (!(await writeAttentionNote(supabase, order, note))) return fail("retry", RETRY_MESSAGE);
  }
  return fail(
    "closed",
    "이미 취소된 주문에 결제가 완료되었습니다. 결제하신 금액은 전액 환불해 드립니다. 다시 이용하시려면 새로 주문해주세요.",
  );
}

/**
 * 취소·환불된 주문으로 확정이 들어온 경우.
 * 결제 기록 없이 취소된 주문(paid_at 없음)은 취소된 뒤에 결제창에서 결제가 끝났을 수 있다 (서버 승인 관문이 없다)
 * → 포트원에 결제가 있으면 확정하지 않고 "확인 필요" 메모를 남겨 일일 리포트가 환불 대상으로 올리게 한다.
 * 결제된 뒤 취소·환불된 주문은 기존 환불 절차(refund_due_krw)가 맡고 있어 조회하지 않는다.
 */
async function rejectClosedOrder(
  supabase: SupabaseClient,
  order: OrderWithApp,
): Promise<ConfirmPaidOrderResult> {
  if (order.paid_at) return fail("closed", CLOSED_ORDER_MESSAGE);

  const lookup = await lookupPortOnePayment(order.order_code);
  if (lookup.kind === "error") return fail("retry", LOOKUP_FAILED_MESSAGE);
  if (lookup.kind !== "found" || lookup.payment.status !== PORTONE_PAID_STATUS) {
    return fail("closed", CLOSED_ORDER_MESSAGE);
  }
  return flagPaidAfterCancel(supabase, order, lookup.payment.totalAmount);
}

/**
 * 조건부 전이가 0행 — 읽은 뒤에 주문 상태가 바뀌었다. 지금 상태를 다시 읽어 판정한다.
 * 다른 호출(새로고침·스윕)이 먼저 확정했으면 성공. 그 사이 취소(스윕·관리자)됐으면 결제만 남은 것이므로
 * 성공이라 하지 않고 환불 대상 메모를 남긴다. 그 외에는 다시 시도하게 한다.
 */
async function resolveLostTransition(
  supabase: SupabaseClient,
  order: OrderWithApp,
  paidKrw: number,
): Promise<{ confirmed: true } | { confirmed: false; result: ConfirmPaidOrderResult }> {
  const { data: current, error } = await supabase
    .from("paid_tester_orders")
    .select("status, paid_at, admin_note")
    .eq("id", order.id)
    .maybeSingle<Pick<OrderWithApp, "status" | "paid_at" | "admin_note">>();
  if (error || !current || current.status === "pending") {
    console.error("[paid-orders] lost transition, state unknown", order.order_code, error);
    return { confirmed: false, result: fail("retry", RETRY_MESSAGE) };
  }
  if (CONFIRMED_ORDER_STATUSES.includes(current.status)) return { confirmed: true };
  // 결제 기록(paid_at)이 있는 취소·환불은 기존 환불 절차가 맡는다
  const result = current.paid_at
    ? fail("closed", CLOSED_ORDER_MESSAGE)
    : await flagPaidAfterCancel(supabase, { ...order, ...current }, paidKrw);
  return { confirmed: false, result };
}

export async function confirmPaidTesterOrder(args: {
  orderId: string;
}): Promise<ConfirmPaidOrderResult> {
  const supabase = createSupabaseAdminClient();

  // 1) 주문 조회 — orderId 는 우리 order_code (= 포트원 결제 ID)
  const { data: order, error: orderErr } = await supabase
    .from("paid_tester_orders")
    .select(
      "id, order_code, app_id, buyer_user_id, tester_count, amount_krw, status, seats_closed, paid_at, admin_note, apps(name)",
    )
    .eq("order_code", args.orderId)
    .maybeSingle<OrderWithApp>();

  if (orderErr || !order) {
    console.error("[paid-orders] order not found", args.orderId, orderErr);
    return orderErr ? fail("retry", RETRY_MESSAGE) : fail("not_found", "주문을 찾을 수 없습니다.");
  }

  const summary = {
    orderCode: order.order_code,
    appName: order.apps?.name ?? `앱 #${order.app_id}`,
    testerCount: order.tester_count,
    amountKrw: order.amount_krw,
  };

  // 2) 상태 가드 — 이미 처리된 주문은 재호출 시 성공으로 응답 (멱등, 포트원 조회 없음)
  if (order.status !== "pending") {
    if (CONFIRMED_ORDER_STATUSES.includes(order.status)) {
      return { ok: true, alreadyPaid: true, order: summary };
    }
    return rejectClosedOrder(supabase, order);
  }

  // 3) 포트원 결제 조회 — 결제 완료(PAID) + 금액 일치만 통과. 통과하지 못하면 아무것도 쓰지 않는다.
  const check = checkPayment(await lookupPortOnePayment(order.order_code), order);
  if (check.kind === "rejected") return check.failure;
  if (check.kind === "mismatch") return flagPaymentMismatch(supabase, order, check.reason);
  // 결제 기록의 멱등 키 = 포트원 결제 ID (= 주문 코드). 조회 응답에 항상 있고 주문당 하나다.
  const providerTxId = check.payment.id;

  const nowIso = new Date().toISOString();

  // 4) payments 기록 — provider_tx_id unique 로 중복 삽입 차단
  const { error: payInsertErr } = await supabase.from("payments").insert({
    user_id: order.buyer_user_id,
    provider: "portone",
    provider_tx_id: providerTxId,
    amount_krw: order.amount_krw,
    purpose: "paid_testers",
    ref_app_id: order.app_id,
    status: "completed",
    paid_at: nowIso,
  });
  if (payInsertErr && payInsertErr.code !== "23505") {
    console.error("[paid-orders] payments insert failed", payInsertErr);
    return fail("retry", "결제 기록 저장에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const { data: payment } = await supabase
    .from("payments")
    .select("id")
    .eq("provider_tx_id", providerTxId)
    .maybeSingle();

  // 5) 주문 전이 — status='pending' 조건이 동시 호출 경합을 정리한다
  const { data: transitioned, error: updateErr } = await supabase
    .from("paid_tester_orders")
    .update({
      status: "paid",
      payment_id: payment?.id ?? null,
      // 포트원 거래 ID — PG 관리자에서 거래를 찾을 때 쓰는 참고값 (없으면 비운다)
      payment_key: check.payment.transactionId ?? null,
      paid_at: nowIso,
    })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");

  if (updateErr) {
    console.error("[paid-orders] order update failed", updateErr);
    return fail("retry", "주문 상태 갱신에 실패했습니다. 관리자에게 문의해주세요.");
  }

  const didTransition = (transitioned ?? []).length > 0;
  if (!didTransition) {
    const lost = await resolveLostTransition(supabase, order, check.payment.totalAmount);
    if (!lost.confirmed) return lost.result;
  }

  // 6) 알림 — 실제 전이가 일어난 호출에서만, 실패해도 주문은 성공 처리
  if (didTransition) {
    try {
      // 결제 전에 이미 시트가 닫힌 주문(심사·시험용)은 급구·전 회원 알림을 보내지 않는다
      if (!order.seats_closed) await activatePaidOrder(supabase, {
        orderId: order.id,
        appId: order.app_id,
        appName: summary.appName,
        seats: order.tester_count,
      });
    } catch (err) {
      console.error("[paid-orders] activate failed", order.order_code, err);
    }
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
    await sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...adminTmpl });

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

export type CreditsOrderResult =
  | { ok: true; orderCode: string }
  | { ok: false; message: string };

/**
 * 보유 크레딧으로 시트 구매 — 카드 결제 없이 즉시 paid. 원장 spend → payments(credits) → 주문 → 활성화.
 * 잔액 검증은 appendLedger 가 수행한다.
 */
export async function createCreditsPaidOrder(args: {
  buyer: { id: number; nickname: string };
  app: { id: number; name: string };
  testerCount: number;
  consentedAt: string;
}): Promise<CreditsOrderResult> {
  const supabase = createSupabaseAdminClient();
  const amount = paidTesterAmountKrw(args.testerCount);
  const orderCode = newPaidOrderCode();

  const { data: order, error: orderErr } = await supabase
    .from("paid_tester_orders")
    .insert({
      order_code: orderCode,
      app_id: args.app.id,
      buyer_user_id: args.buyer.id,
      tester_count: args.testerCount,
      amount_krw: amount,
      consented_at: args.consentedAt,
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    console.error("[paid-orders] credits order insert failed", orderErr);
    return { ok: false, message: "주문 생성에 실패했습니다." };
  }

  const ledger = await appendLedger(supabase, {
    userId: args.buyer.id,
    amount: -amount,
    type: "spend",
    refType: "paid_order",
    refId: order.id,
    description: `유료 테스터 ${args.testerCount}명 — ${args.app.name}`,
  });
  if (!ledger.ok) {
    await supabase
      .from("paid_tester_orders")
      .update({ status: "canceled", admin_note: "크레딧 잔액 부족으로 자동 취소" })
      .eq("id", order.id);
    return { ok: false, message: ledger.message };
  }

  const nowIso = new Date().toISOString();
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      user_id: args.buyer.id,
      provider: "credits",
      provider_tx_id: `credits_${orderCode}`,
      amount_krw: amount,
      purpose: "paid_testers",
      ref_app_id: args.app.id,
      status: "completed",
      paid_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  const { data: paidRows, error: paidErr } = await supabase
    .from("paid_tester_orders")
    .update({ status: "paid", payment_id: payment?.id ?? null, paid_at: nowIso })
    .eq("id", order.id)
    .eq("status", "pending")
    .select("id");
  if (paidErr || !paidRows || paidRows.length === 0) {
    // 차감은 됐는데 주문이 안 열렸다 → 즉시 환급 (멱등 unique) 후 실패 응답
    console.error("[paid-orders] credits order paid-update failed", order.id, paidErr);
    const refund = await appendLedger(supabase, {
      userId: args.buyer.id,
      amount,
      type: "refund",
      refType: "paid_order",
      refId: order.id,
      description: "주문 생성 실패 환급",
    });
    await supabase
      .from("paid_tester_orders")
      .update({ status: "canceled", admin_note: "주문 확정 실패 — 크레딧 자동 환급" })
      .eq("id", order.id);
    return {
      ok: false,
      message: refund.ok
        ? "주문 확정에 실패해 크레딧을 환급했습니다. 다시 시도해주세요."
        : "주문 확정에 실패했습니다. 관리자에게 문의해주세요.",
    };
  }

  try {
    await activatePaidOrder(supabase, {
      orderId: order.id,
      appId: args.app.id,
      appName: args.app.name,
      seats: args.testerCount,
    });
  } catch (err) {
    console.error("[paid-orders] activate failed (credits)", orderCode, err);
  }
  // 크레딧 결제도 관리자 메일·구매자 영수 안내를 보낸다 (오픈채팅 공지 누락 방지)
  await notifyPaidOrder(
    {
      id: order.id,
      order_code: orderCode,
      app_id: args.app.id,
      buyer_user_id: args.buyer.id,
      tester_count: args.testerCount,
      amount_krw: amount,
      status: "paid",
      apps: { name: args.app.name },
    },
    { orderCode, appName: args.app.name, testerCount: args.testerCount, amountKrw: amount },
  );
  return { ok: true, orderCode };
}
