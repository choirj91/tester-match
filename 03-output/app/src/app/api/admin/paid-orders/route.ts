import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z, ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOrderSlots } from "@/lib/console-data";
import { REFUND_FAILED_NOTE_PREFIX, decidePendingOrder } from "@/lib/paid-order-sweep-rules";
import { confirmPaidTesterOrder } from "@/lib/paid-orders";
import {
  SEAT_FILLED_MATCH_STATUSES,
  closeOrderSeats,
  isCreditsPaidOrder,
  refundCreditsOrder,
  settleOrderIfDone,
} from "@/lib/paid-seats";
import { expectedPortOnePayment, lookupPortOnePayment } from "@/lib/portone";

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["start", "complete", "cancel", "close_seats", "mark_refunded"]),
});

type OrderRow = {
  id: number;
  order_code: string;
  amount_krw: number;
  status: string;
  fulfillment: "community" | "operator";
  seats_closed: boolean;
  refund_due_krw: number;
  refunded_krw: number;
  admin_note: string | null;
};

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, message }, { status });

const STALE_STATE = "전이할 수 없는 상태입니다. 새로고침 후 다시 확인해주세요.";

/** 시트 마감: 빈 시트를 닫고 환불 처리 (충원 7일 자동 마감의 수동 버전). 진행 중 테스터는 그대로. */
async function closeSeats(supabase: SupabaseClient, order: OrderRow) {
  const result = await closeOrderSeats(supabase, order.id, "운영자가 시트를 마감했습니다");
  if (!result) {
    // 이미 마감된 주문이면 종결 판정만 다시 돌린다 (종결 갱신이 실패해 열린 채 남은 주문의 복구)
    await settleOrderIfDone(supabase, order.id);
    return fail("이미 마감됐거나 마감할 수 없는 상태입니다.", 409);
  }
  if (result.refund && !result.refund.ok) {
    return fail(
      result.reverted
        ? "마감을 끝내지 못해 되돌렸습니다. 잠시 후 다시 시도해주세요."
        : "시트는 마감됐지만 미충원 시트 환불을 기록하지 못했습니다 — 수동 조정이 필요합니다 (주문 메모 참고).",
      500,
    );
  }
  return NextResponse.json({ ok: true, unfilled: result.unfilled, refund: result.refund });
}

/** PG 관리자(포트원 콘솔)에서 부분취소를 끝낸 뒤 누른다 — 환불 대기 금액을 환불 완료로 옮김 */
async function markRefunded(supabase: SupabaseClient, order: OrderRow) {
  if (order.refund_due_krw <= 0) return fail("환불 대기 금액이 없습니다.", 409);
  const { data: moved } = await supabase
    .from("paid_tester_orders")
    .update({ refund_due_krw: 0, refunded_krw: order.refunded_krw + order.refund_due_krw })
    .eq("id", order.id)
    .eq("refund_due_krw", order.refund_due_krw)
    .select("id");
  if (!moved || moved.length === 0) return fail("다시 시도해주세요.", 409);
  return NextResponse.json({ ok: true, refunded: order.refund_due_krw });
}

/** 운영자 폴백 개시: 커뮤니티 시트 배정을 멈추고 운영자 처리 주문으로 바꾼다 — 한 번의 조건부 UPDATE */
async function startOperator(supabase: SupabaseClient, order: OrderRow) {
  const { data, error } = await supabase
    .from("paid_tester_orders")
    .update({
      status: "in_progress",
      started_at: new Date().toISOString(),
      seats_closed: true,
      fulfillment: "operator",
    })
    .eq("id", order.id)
    .eq("status", "paid")
    .eq("fulfillment", "community")
    .eq("seats_closed", false)
    .select("id, status");
  if (error) {
    console.error("[admin/paid-orders] start failed", error);
    return fail("갱신에 실패했습니다.", 500);
  }
  if (!data || data.length === 0) return fail(STALE_STATE, 409);
  await ensureOrderSlots(order.id);
  return NextResponse.json({ ok: true, status: data[0].status });
}

/** 완료: 운영자 처리 주문만 수동 완료한다. 커뮤니티 주문은 테스터 완주·시트 마감으로 자동 종결된다. */
async function completeOrder(supabase: SupabaseClient, order: OrderRow) {
  if (order.fulfillment !== "operator") {
    return fail("커뮤니티 주문은 자동 종결됩니다. 빈 시트를 닫으려면 [시트 마감]을 사용하세요.", 409);
  }
  const { data, error } = await supabase
    .from("paid_tester_orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", order.id)
    .in("status", ["paid", "in_progress"])
    .eq("fulfillment", "operator")
    .select("id, status");
  if (error) {
    console.error("[admin/paid-orders] complete failed", error);
    return fail("갱신에 실패했습니다.", 500);
  }
  if (!data || data.length === 0) return fail(STALE_STATE, 409);
  return NextResponse.json({ ok: true, status: data[0].status });
}

/** 전액 취소가 가능한 상태 — 운영자 처리 주문은 진행 중에도 취소(환불)할 수 있다 */
function cancelableStatuses(order: OrderRow): string[] {
  return order.fulfillment === "operator" ? ["pending", "paid", "in_progress"] : ["pending", "paid"];
}

/** 환불에 실패한 취소를 되돌린다 (상태·메모). 되돌리기도 실패하면 "환불 실패" 메모를 남긴다 (리포트 경보). */
async function revertCancel(supabase: SupabaseClient, order: OrderRow): Promise<boolean> {
  const { error } = await supabase
    .from("paid_tester_orders")
    .update({ status: order.status, admin_note: order.admin_note })
    .eq("id", order.id)
    .eq("status", "canceled");
  if (!error) return true;
  console.error("[admin/paid-orders] cancel revert failed", order.id, error);
  await supabase
    .from("paid_tester_orders")
    .update({
      admin_note: `${REFUND_FAILED_NOTE_PREFIX} — 수동 조정 필요 (관리자 취소 후 전액 환불 미처리)`,
    })
    .eq("id", order.id);
  return false;
}

/**
 * 미결제(pending) 카드 주문을 취소하기 전에 포트원에 결제를 조회한다 — 서버 승인 관문이 없어
 * 결제창에서 이미 결제가 끝났는데 우리 쪽 반영만 빠진 주문일 수 있다.
 * 판정은 스윕과 같은 규칙(decidePendingOrder)을 쓴다: 취소 가능(cancel)일 때만 null 을 돌려 기존 취소 절차로 넘어간다.
 * 결제 완료(recover)면 취소하지 않고 바로 확정하고, 판단할 수 없으면(hold) 사유를 알리고 취소하지 않는다.
 * 크레딧 결제 주문은 카드 결제가 없으므로 조회하지 않는다.
 */
async function guardPendingCardCancel(
  supabase: SupabaseClient,
  order: OrderRow,
): Promise<NextResponse | null> {
  if ((await isCreditsPaidOrder(supabase, order.id)) === true) return null;

  const decision = decidePendingOrder(await lookupPortOnePayment(order.order_code), expectedPortOnePayment(order.amount_krw));
  if (decision.action === "cancel") return null;
  if (decision.action === "hold") {
    return fail(`취소하지 않았습니다 — ${decision.reason}. 잠시 후 다시 시도하거나 PG 관리자(포트원 콘솔)에서 확인해주세요.`, 409);
  }

  const confirmed = await confirmPaidTesterOrder({ orderId: order.order_code });
  return fail(
    confirmed.ok
      ? "이미 카드 결제가 완료된 주문이라 취소하지 않았습니다. 결제를 반영했으니 새로고침 후 확인해주세요."
      : `이미 카드 결제가 완료된 주문이라 취소하지 않았습니다. 결제 반영은 실패했습니다 (${confirmed.message}) — 새로고침 후 확인해주세요.`,
    409,
  );
}

/**
 * 취소 = 전액 환불. 테스터가 참여했거나 시트가 마감된 커뮤니티 주문은 거부한다 (부분 환불이 이미 돌았을 수 있다).
 * 상태를 먼저 바꾸고(읽은 상태 그대로일 때만 — 조건부 UPDATE 가 동시 실행을 한 번으로 만든다) 환불한다.
 * 환불이 실패하면 되돌려 다시 누를 수 있게 한다.
 */
async function cancelOrder(supabase: SupabaseClient, order: OrderRow, adminNickname: string) {
  if (!cancelableStatuses(order).includes(order.status)) return fail(STALE_STATE, 409);

  if (order.status === "pending") {
    const blocked = await guardPendingCardCancel(supabase, order);
    if (blocked) return blocked;
  }

  const { count: filled, error: countErr } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("paid_order_id", order.id)
    .in("status", [...SEAT_FILLED_MATCH_STATUSES]);
  // 참여자 수를 모르면 취소하지 않는다 — 0명으로 읽으면 진행 중인 주문을 전액 환불하게 된다
  if (countErr) {
    console.error("[admin/paid-orders] seat count failed", order.id, countErr);
    return fail("참여 테스터 수를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
  if ((filled ?? 0) > 0) {
    return fail(
      `테스터 ${filled}명이 참여한 주문은 전액 취소할 수 없습니다. [시트 마감]으로 빈 시트만 환불하세요.`,
      409,
    );
  }

  let flip = supabase
    .from("paid_tester_orders")
    .update({ status: "canceled", admin_note: `관리자 취소 (${adminNickname})` })
    .eq("id", order.id)
    .eq("status", order.status);
  // 시트 마감(빈 시트 환불)과 동시에 실행돼도 둘 중 하나만 성립하게 한다
  if (order.fulfillment === "community") flip = flip.eq("seats_closed", false);
  const { data, error } = await flip.select("id");
  if (error) {
    console.error("[admin/paid-orders] cancel failed", error);
    return fail("갱신에 실패했습니다.", 500);
  }
  if (!data || data.length === 0) {
    return fail("취소할 수 없는 상태입니다 (방금 상태가 바뀌었거나 시트가 마감됨). 새로고침 후 확인해주세요.", 409);
  }

  const refund = await refundCreditsOrder(supabase, order.id, "관리자 취소");
  if (refund.ok) return NextResponse.json({ ok: true, status: "canceled", refund: refund.kind });

  const reverted = await revertCancel(supabase, order);
  const cause = refund.message ?? "원인 미상";
  return fail(
    reverted
      ? `환불에 실패해 취소를 되돌렸습니다. 잠시 후 다시 시도해주세요 (${cause})`
      : `주문은 취소됐지만 환불에 실패했습니다 — 수동 조정 필요 (${cause})`,
    500,
  );
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return fail("권한이 없습니다.", 403);

  let payload;
  try {
    payload = ActionSchema.parse(await req.json());
  } catch (err) {
    return fail(err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청", 400);
  }

  const supabase = createSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("paid_tester_orders")
    .select("id, order_code, amount_krw, status, fulfillment, seats_closed, refund_due_krw, refunded_krw, admin_note")
    .eq("id", payload.id)
    .maybeSingle<OrderRow>();
  if (error) {
    console.error("[admin/paid-orders] order load failed", error);
    return fail("주문을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", 500);
  }
  if (!order) return fail("주문을 찾을 수 없습니다.", 404);

  switch (payload.action) {
    case "close_seats":
      return closeSeats(supabase, order);
    case "mark_refunded":
      return markRefunded(supabase, order);
    case "start":
      return startOperator(supabase, order);
    case "complete":
      return completeOrder(supabase, order);
    case "cancel":
      return cancelOrder(supabase, order, admin.nickname);
  }
}
