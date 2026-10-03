import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z, ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ensureOrderSlots } from "@/lib/console-data";
import { REFUND_FAILED_NOTE_PREFIX } from "@/lib/paid-order-sweep-rules";
import {
  SEAT_FILLED_MATCH_STATUSES,
  closeOrderSeats,
  refundCreditsOrder,
  settleOrderIfDone,
} from "@/lib/paid-seats";

export const runtime = "edge";

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["start", "complete", "cancel", "close_seats", "mark_refunded"]),
});

type OrderRow = {
  id: number;
  status: string;
  fulfillment: "community" | "operator";
  seats_closed: boolean;
  refund_due_krw: number;
  refunded_krw: number;
};

const fail = (message: string, status: number) =>
  NextResponse.json({ ok: false, message }, { status });

const STALE_STATE = "전이할 수 없는 상태입니다. 새로고침 후 다시 확인해주세요.";

/** 시트 마감: 빈 시트를 닫고 환불 처리 (충원 7일 자동 마감의 수동 버전). 진행 중 테스터는 그대로. */
async function closeSeats(supabase: SupabaseClient, orderId: number) {
  const result = await closeOrderSeats(supabase, orderId, "운영자가 시트를 마감했습니다");
  if (!result) {
    // 이미 마감된 주문이면 종결 판정만 다시 돌린다 (종결 갱신이 실패해 열린 채 남은 주문의 복구)
    await settleOrderIfDone(supabase, orderId);
    return fail("이미 마감됐거나 마감할 수 없는 상태입니다.", 409);
  }
  if (result.refund && !result.refund.ok) {
    return fail("미충원 시트 환불 기록에 실패해 마감을 되돌렸습니다. 다시 시도해주세요.", 500);
  }
  return NextResponse.json({ ok: true, unfilled: result.unfilled, refund: result.refund });
}

/** 토스 부분취소를 대시보드에서 끝낸 뒤 누른다 — 환불 대기 금액을 환불 완료로 옮김 */
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

/**
 * 취소 = 전액 환불. 테스터가 참여했거나 시트가 마감된 커뮤니티 주문은 거부한다 (부분 환불이 이미 돌았을 수 있다).
 * 상태를 먼저 바꾸고(조건부 UPDATE 가 동시 실행을 한 번으로 만든다) 환불한다. 환불이 실패하면 상태를 되돌려
 * 다시 누를 수 있게 하고, 되돌리기도 실패하면 "환불 실패" 메모를 남긴다.
 */
async function cancelOrder(supabase: SupabaseClient, order: OrderRow, adminNickname: string) {
  const { count: filled } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("paid_order_id", order.id)
    .in("status", [...SEAT_FILLED_MATCH_STATUSES]);
  if ((filled ?? 0) > 0) {
    return fail(
      `테스터 ${filled}명이 참여한 주문은 전액 취소할 수 없습니다. [시트 마감]으로 빈 시트만 환불하세요.`,
      409,
    );
  }

  const previousStatus = order.status;
  let flip = supabase
    .from("paid_tester_orders")
    .update({ status: "canceled", admin_note: `관리자 취소 (${adminNickname})` })
    .eq("id", order.id)
    .in("status", ["pending", "paid"]);
  // 시트 마감(빈 시트 환불)과 동시에 실행돼도 둘 중 하나만 성립하게 한다
  if (order.fulfillment === "community") flip = flip.eq("seats_closed", false);
  const { data, error } = await flip.select("id, status");
  if (error) {
    console.error("[admin/paid-orders] cancel failed", error);
    return fail("갱신에 실패했습니다.", 500);
  }
  if (!data || data.length === 0) {
    return fail("취소할 수 없는 상태입니다 (이미 종결됐거나 시트가 마감됨). 새로고침 후 확인해주세요.", 409);
  }

  const refund = await refundCreditsOrder(supabase, order.id, "관리자 취소");
  if (refund.ok) return NextResponse.json({ ok: true, status: "canceled", refund: refund.kind });

  const { error: revertErr } = await supabase
    .from("paid_tester_orders")
    .update({ status: previousStatus })
    .eq("id", order.id)
    .eq("status", "canceled");
  if (revertErr) {
    console.error("[admin/paid-orders] cancel revert failed", order.id, revertErr);
    await supabase
      .from("paid_tester_orders")
      .update({
        admin_note: `${REFUND_FAILED_NOTE_PREFIX} — 수동 조정 필요 (관리자 취소 후 전액 환불 미처리)`,
      })
      .eq("id", order.id);
    return fail(
      `주문은 취소됐지만 환불에 실패했습니다 — 수동 조정 필요 (${refund.message ?? "원인 미상"})`,
      500,
    );
  }
  return fail(
    `환불에 실패해 취소를 되돌렸습니다. 잠시 후 다시 시도해주세요 (${refund.message ?? "원인 미상"})`,
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
  if (payload.action === "close_seats") return closeSeats(supabase, payload.id);

  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("id, status, fulfillment, seats_closed, refund_due_krw, refunded_krw")
    .eq("id", payload.id)
    .maybeSingle<OrderRow>();
  if (!order) return fail("주문을 찾을 수 없습니다.", 404);

  switch (payload.action) {
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
