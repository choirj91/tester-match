/**
 * 유료 시트 보상 에스크로 (ADR-0012 부록 A·C) — 서버 전용. 규칙·산정은 seat-reward-rules.ts.
 *
 * 완주 → held(보류) → 구매자 확정 | 3일 무응답 자동 확정 → released(원장 적립)
 *                    → 구매자 이의 → disputed → 관리자: released | forfeited(구매자 시트 환불)
 * 출시 보너스: 등록자가 앱을 "출시 완료"로 바꾸면 released 시트 테스터에게 +100 (크론이 지급).
 *
 * Cloudflare 무료 플랜의 요청당 서브리퀘스트 상한(50) 때문에 모든 일괄 처리에 실행당 상한을 두고,
 * 상태 전이는 조건부 UPDATE + 원장 부분 unique 로 멱등하게 해 다음 실행이 이어받도록 한다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PAID_SEAT_LAUNCH_LEDGER_REF, PAID_SEAT_LEDGER_REF, appendLedger, formatKrw } from "@/lib/credits";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { seatRewardDisputedEmail } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications";
import { noteRefundFailure, refundSeats, settleOrderIfDone } from "@/lib/paid-seats";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_DECISION_DAYS,
  SEAT_MIN_CHECKIN_DAYS,
  SEAT_REWARDS,
  SEAT_REWARD_HOLD_DAYS,
  SEAT_TOTAL_DAYS,
  computeSeatReward,
  type DisputeCategory,
  type SeatRewardBreakdown,
  type SeatRewardStatus,
} from "@/lib/seat-reward-rules";

export * from "@/lib/seat-reward-rules";

const DAY_MS = 24 * 60 * 60 * 1000;

type Result = { ok: true } | { ok: false; message: string };

/** 보상 보류 생성 (match_id unique → 멱등) + 테스터·구매자 알림. 생성했으면 금액, 아니면 0. */
async function holdSeatReward(
  supabase: SupabaseClient,
  args: { matchId: number; orderId: number; testerUserId: number; breakdown: SeatRewardBreakdown },
): Promise<number> {
  const { breakdown } = args;
  const dueAt = new Date(Date.now() + SEAT_REWARD_HOLD_DAYS * DAY_MS).toISOString();
  const { error } = await supabase.from("seat_rewards").insert({
    match_id: args.matchId,
    order_id: args.orderId,
    tester_user_id: args.testerUserId,
    amount: breakdown.total,
    checkin_days: Math.min(breakdown.days, SEAT_TOTAL_DAYS),
    breakdown,
    release_due_at: dueAt,
  });
  if (error) {
    if (error.code !== "23505") console.error("[seat-rewards] hold insert failed", error);
    return 0;
  }

  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("buyer_user_id, apps(name)")
    .eq("id", args.orderId)
    .maybeSingle<{ buyer_user_id: number; apps: { name: string } | null }>();
  const appName = order?.apps?.name ?? "앱";
  const amountLabel = breakdown.total.toLocaleString("ko-KR");

  await createNotification({
    userId: args.testerUserId,
    type: "seat_reward",
    title: `완주! ${amountLabel} 크레딧 확정 대기`,
    body: `"${appName}" 유료 시트 ${breakdown.days}일 출석 완료 (설치 ${breakdown.install} + 출석 ${breakdown.attendance} + 보너스 ${breakdown.streak + breakdown.completion + breakdown.perfect}). 구매자가 확인하면 바로, 응답이 없으면 ${SEAT_REWARD_HOLD_DAYS}일 뒤 자동 지급됩니다. 앱이 정식 출시되면 +${SEAT_REWARDS.launch}.`,
    link: "/credits",
  });
  if (order) {
    const { data: buyer } = await supabase
      .from("users")
      .select("email")
      .eq("id", order.buyer_user_id)
      .maybeSingle();
    if (buyer?.email && !buyer.email.endsWith("@deleted.local")) {
      await sendEmail({
        to: buyer.email,
        subject: `[Tester Match] "${appName}" 테스터 완주 — ${SEAT_REWARD_HOLD_DAYS}일 내 확정해주세요`,
        html: `<p>"${appName}" 시트 테스터가 ${breakdown.days}일 출석을 마쳤습니다.</p><p>콘솔에서 스크린샷을 확인하고 <strong>[확정]</strong> 또는 <strong>[이의 제기]</strong>를 선택해주세요. ${SEAT_REWARD_HOLD_DAYS}일간 응답이 없으면 자동 확정됩니다.</p><p><a href="${SITE_URL}/console/orders/${args.orderId}">콘솔에서 확인하기</a></p>`,
        text: `"${appName}" 테스터 완주 — ${SEAT_REWARD_HOLD_DAYS}일 내 확정/이의, 미응답 시 자동 확정.\n${SITE_URL}/console/orders/${args.orderId}`,
      });
    }
    await createNotification({
      userId: order.buyer_user_id,
      type: "seat_reward",
      title: "테스터 완주 — 확인이 필요합니다",
      body: `"${appName}" 시트 테스터가 ${breakdown.days}일 출석을 마쳤습니다. 콘솔에서 [확정] 또는 [이의 제기]를 선택하세요. ${SEAT_REWARD_HOLD_DAYS}일간 응답이 없으면 자동 확정됩니다.`,
      link: `/console/orders/${args.orderId}`,
    });
  }
  return breakdown.total;
}

/** 스크린샷 증빙이 있는 체크인 일차 목록 */
async function evidencedDays(supabase: SupabaseClient, matchId: number): Promise<number[]> {
  const { data } = await supabase
    .from("checkins")
    .select("day_n")
    .eq("match_id", matchId)
    .not("screenshot_url", "is", null);
  return (data ?? []).map((c) => c.day_n);
}

/** 여러 매칭의 증빙 일차를 한 번에 읽는다 */
async function evidencedDaysByMatch(
  supabase: SupabaseClient,
  matchIds: number[],
): Promise<Map<number, number[]>> {
  const { data } = await supabase
    .from("checkins")
    .select("match_id, day_n")
    .in("match_id", matchIds)
    .not("screenshot_url", "is", null);
  const daysByMatch = new Map<number, number[]>();
  for (const c of data ?? []) {
    daysByMatch.set(c.match_id, [...(daysByMatch.get(c.match_id) ?? []), c.day_n]);
  }
  return daysByMatch;
}

/** 유료 시트 완주 처리: 매칭 completed → 보상 보류 → 주문 종결 검사. 멱등. */
export async function completePaidSeat(
  supabase: SupabaseClient,
  args: { matchId: number; orderId: number; testerUserId: number },
): Promise<{ completed: boolean; heldAmount: number }> {
  const days = await evidencedDays(supabase, args.matchId);
  const breakdown = computeSeatReward(days);
  // 스크린샷 증빙이 12일 미만이면 완주로 바꾸지 않는다 — 보상 없는 완주(구매자만 과금)를 만들지 않는다
  if (breakdown.days < SEAT_MIN_CHECKIN_DAYS) {
    console.error("[seat-rewards] not enough evidence to complete", args.matchId, breakdown.days);
    return { completed: false, heldAmount: 0 };
  }
  const { data: rows } = await supabase
    .from("matches")
    .update({ status: "completed", day_count: Math.min(breakdown.days, SEAT_TOTAL_DAYS) })
    .eq("id", args.matchId)
    .eq("status", "active")
    .select("id");
  if (!rows || rows.length === 0) return { completed: false, heldAmount: 0 };

  const heldAmount = await holdSeatReward(supabase, { ...args, breakdown });
  await settleOrderIfDone(supabase, args.orderId);
  return { completed: true, heldAmount };
}

type RewardRow = {
  id: number;
  match_id: number;
  order_id: number;
  tester_user_id: number;
  amount: number;
  status: SeatRewardStatus;
};

/** 보류 → 지급. 원장 적립 실패 시 상태를 되돌린다. admin·fromDisputed 는 disputed 도 지급 가능. */
export async function releaseSeatReward(
  supabase: SupabaseClient,
  rewardId: number,
  by: "buyer" | "auto" | "admin",
  options: { fromDisputed?: boolean } = {},
): Promise<Result> {
  const { data: before } = await supabase
    .from("seat_rewards")
    .select("id, match_id, order_id, tester_user_id, amount, status")
    .eq("id", rewardId)
    .maybeSingle<RewardRow>();
  if (!before) return { ok: false, message: "보상 내역을 찾을 수 없습니다." };

  const from: SeatRewardStatus[] =
    by === "admin" || options.fromDisputed ? ["held", "disputed"] : ["held"];
  const { data: moved } = await supabase
    .from("seat_rewards")
    .update({ status: "released", settled_at: new Date().toISOString(), settled_by: by })
    .eq("id", rewardId)
    .in("status", from)
    .select("id");
  if (!moved || moved.length === 0) {
    return { ok: false, message: "이미 처리되었거나 확정할 수 없는 상태입니다." };
  }

  const ledger = await appendLedger(supabase, {
    userId: before.tester_user_id,
    amount: before.amount,
    type: "earn",
    refType: PAID_SEAT_LEDGER_REF,
    refId: before.match_id,
    description: "유료 시트 보상 확정",
  });
  if (!ledger.ok) {
    // 되돌리기가 실패해도 repairReleasedWithoutEarn 이 다음 크론에서 적립을 채운다
    await supabase
      .from("seat_rewards")
      .update({ status: before.status, settled_at: null, settled_by: null })
      .eq("id", rewardId)
      .eq("status", "released");
    console.error("[seat-rewards] release ledger failed", rewardId, ledger.message);
    return { ok: false, message: "크레딧 적립에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  await createNotification({
    userId: before.tester_user_id,
    type: "seat_reward",
    title: `${before.amount.toLocaleString("ko-KR")} 크레딧이 지급되었습니다`,
    body:
      by === "auto"
        ? "자동 확정되었습니다. 시트 구매 또는 기프티콘 교환에 사용할 수 있습니다."
        : "보상이 확정되었습니다. 시트 구매 또는 기프티콘 교환에 사용할 수 있습니다.",
    link: "/credits",
  });
  if (by !== "buyer") {
    // 약관: 판정·자동 확정은 양 당사자에게 통지
    const { data: order } = await supabase
      .from("paid_tester_orders")
      .select("buyer_user_id")
      .eq("id", before.order_id)
      .maybeSingle();
    if (order) {
      const wasDisputed = before.status === "disputed";
      await createNotification({
        userId: order.buyer_user_id,
        type: "seat_reward",
        title: wasDisputed ? "이의 건의 보상이 지급되었습니다" : "테스터 보상이 자동 확정되었습니다",
        body: wasDisputed
          ? by === "admin"
            ? "운영팀이 스크린샷 증빙을 확인한 결과 테스터 보상을 지급했습니다."
            : `이의 접수 후 ${DISPUTE_DECISION_DAYS}일의 판정 기한이 지나 약관에 따라 테스터 보상이 지급되었습니다.`
          : `${SEAT_REWARD_HOLD_DAYS}일간 응답이 없어 테스터 보상이 자동 확정되었습니다.`,
        link: `/console/orders/${before.order_id}`,
      });
    }
  }
  return { ok: true };
}

/** 구매자 이의 제기: held → disputed. 관리자에게 메일, 테스터에게 사유 통지. */
export async function disputeSeatReward(
  supabase: SupabaseClient,
  rewardId: number,
  category: DisputeCategory,
  reason: string,
): Promise<Result> {
  const { data: moved } = await supabase
    .from("seat_rewards")
    .update({
      status: "disputed",
      dispute_category: category,
      dispute_reason: reason,
      disputed_at: new Date().toISOString(),
    })
    .eq("id", rewardId)
    .eq("status", "held")
    .select("id, order_id, tester_user_id, amount");
  const row = moved?.[0];
  if (!row) return { ok: false, message: "이미 처리되었거나 이의를 제기할 수 없는 상태입니다." };

  await createNotification({
    userId: row.tester_user_id,
    type: "seat_reward",
    title: "보상에 이의가 제기되었습니다",
    body: `구매자 이의: ${DISPUTE_CATEGORIES[category]} — "${reason.slice(0, 120)}". 운영팀이 스크린샷 증빙을 확인해 ${DISPUTE_DECISION_DAYS}일 안에 판정하며, 기한 내 판정이 없으면 자동 지급됩니다. 소명은 문의 메일로 보내주세요.`,
    link: "/credits",
  });
  const tmpl = seatRewardDisputedEmail({
    rewardId: row.id,
    orderId: row.order_id,
    amount: row.amount,
    reason: `[${DISPUTE_CATEGORIES[category]}] ${reason}`,
  });
  await sendEmail({ to: getAdminNotifyEmail(CONTACT_EMAIL), ...tmpl });
  return { ok: true };
}

/**
 * 관리자 몰수: disputed → forfeited + 구매자 시트 환불 (완주한 시트만 과금).
 * 환불 기록이 실패하면 몰수를 되돌려 다시 시도할 수 있게 한다.
 */
export async function forfeitSeatReward(
  supabase: SupabaseClient,
  rewardId: number,
  adminNote: string,
): Promise<Result> {
  const { data: moved } = await supabase
    .from("seat_rewards")
    .update({
      status: "forfeited",
      settled_at: new Date().toISOString(),
      settled_by: "admin",
      admin_note: adminNote || null,
    })
    .eq("id", rewardId)
    .eq("status", "disputed")
    .select("id, tester_user_id, amount, order_id, match_id");
  const row = moved?.[0];
  if (!row) return { ok: false, message: "이의 검토 중인 보상만 몰수할 수 있습니다." };

  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("buyer_user_id")
    .eq("id", row.order_id)
    .maybeSingle();
  if (!order) {
    const reverted = await revertForfeit(supabase, rewardId, row.order_id, row.match_id);
    return { ok: false, message: forfeitFailureMessage("주문을 찾지 못해", reverted) };
  }
  const refund = await refundSeats(supabase, {
    orderId: row.order_id,
    buyerUserId: order.buyer_user_id,
    seats: 1,
    refType: "paid_seat_refund",
    refId: row.match_id,
    reason: "이의 인용",
  });
  if (!refund.ok) {
    const reverted = await revertForfeit(supabase, rewardId, row.order_id, row.match_id);
    return { ok: false, message: forfeitFailureMessage("구매자 환불 기록에 실패해", reverted) };
  }

  await createNotification({
    userId: order.buyer_user_id,
    type: "seat_reward",
    title: "이의가 인용되었습니다",
    body:
      refund.mode === "credits"
        ? `해당 시트의 테스터 보상은 지급되지 않으며 ${formatKrw(PAID_TESTER_PRICE_KRW)} 크레딧이 복구되었습니다.`
        : `해당 시트의 테스터 보상은 지급되지 않으며 ${formatKrw(PAID_TESTER_PRICE_KRW)}원은 영업일 3일 내 부분 취소됩니다.`,
    link: `/console/orders/${row.order_id}`,
  });
  await createNotification({
    userId: row.tester_user_id,
    type: "seat_reward",
    title: "보상이 지급되지 않았습니다",
    body: `운영팀 검토 결과 이 시트의 보상(${row.amount.toLocaleString("ko-KR")} 크레딧)은 지급되지 않습니다.${adminNote ? ` 사유: ${adminNote}` : ""}`,
    link: "/credits",
  });
  return { ok: true };
}

/** 몰수 되돌리기. 실패하면 몰수된 채 환불이 빠지므로 주문에 "환불 실패" 메모를 남긴다. @returns 되돌렸으면 true */
async function revertForfeit(
  supabase: SupabaseClient,
  rewardId: number,
  orderId: number,
  matchId: number,
): Promise<boolean> {
  const { error } = await supabase
    .from("seat_rewards")
    .update({ status: "disputed", settled_at: null, settled_by: null })
    .eq("id", rewardId)
    .eq("status", "forfeited");
  if (!error) return true;
  console.error("[seat-rewards] forfeit revert failed", rewardId, error);
  await noteRefundFailure(supabase, orderId, `몰수 후 시트 환불 미처리 (match ${matchId}, 1,000)`);
  return false;
}

function forfeitFailureMessage(cause: string, reverted: boolean): string {
  return reverted
    ? `${cause} 몰수를 취소했습니다. 다시 시도해주세요.`
    : `${cause} 환불하지 못했고 몰수도 되돌리지 못했습니다 — 주문 관리에서 수동 조정이 필요합니다.`;
}

/**
 * 크론: 보류 기한이 지난 보상 자동 확정 + 판정 기한(7일)이 지난 이의 건 자동 지급.
 * 한 번에 limit 건만 처리하고 남은 건수를 돌려준다 (호출자가 반복 호출).
 */
export async function releaseDueRewards(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ attempted: number; released: number; remaining: number }> {
  const nowIso = new Date().toISOString();
  const disputeCutoff = new Date(Date.now() - DISPUTE_DECISION_DAYS * DAY_MS).toISOString();
  const [held, stale] = await Promise.all([
    supabase
      .from("seat_rewards")
      .select("id", { count: "exact" })
      .eq("status", "held")
      .lte("release_due_at", nowIso)
      .order("release_due_at", { ascending: true })
      .limit(limit),
    supabase
      .from("seat_rewards")
      .select("id", { count: "exact" })
      .eq("status", "disputed")
      .lte("disputed_at", disputeCutoff)
      .order("disputed_at", { ascending: true })
      .limit(limit),
  ]);
  const queue: Array<{ id: number; fromDisputed: boolean }> = [
    ...(held.data ?? []).map((r) => ({ id: r.id, fromDisputed: false })),
    ...(stale.data ?? []).map((r) => ({ id: r.id, fromDisputed: true })),
  ].slice(0, limit);

  let released = 0;
  for (const item of queue) {
    const result = await releaseSeatReward(supabase, item.id, "auto", {
      fromDisputed: item.fromDisputed,
    });
    if (result.ok) released++;
  }
  const total = (held.count ?? 0) + (stale.count ?? 0);
  return { attempted: queue.length, released, remaining: Math.max(0, total - queue.length) };
}

/**
 * 보정 1: 완주(completed)한 유료 시트인데 보류 레코드가 없는 매칭 → 보류 생성.
 * (완주 전이와 보류 INSERT 사이에서 실패한 경우의 복구)
 */
/** 한 번에 증빙을 읽을 시트 수 — 시트당 체크인 14행 기준으로 1,000행 상한 안쪽 */
const REPAIR_SCAN_LIMIT = 50;

export async function repairMissingHolds(supabase: SupabaseClient, limit: number): Promise<number> {
  const { data: seats } = await supabase
    .from("matches")
    .select("id, paid_order_id, tester_user_id")
    .eq("status", "completed")
    .not("paid_order_id", "is", null)
    .order("id", { ascending: false })
    .limit(300);
  const candidates = (seats ?? []) as Array<{
    id: number;
    paid_order_id: number;
    tester_user_id: number;
  }>;
  if (candidates.length === 0) return 0;

  const { data: existing } = await supabase
    .from("seat_rewards")
    .select("match_id")
    .in(
      "match_id",
      candidates.map((c) => c.id),
    );
  const have = new Set((existing ?? []).map((r) => r.match_id));

  // 증빙 일수를 한 번에 읽어 보상 대상만 추린다 — 보상 불가 시트가 처리 한도를 차지하지 않게
  const missing = candidates.filter((x) => !have.has(x.id)).slice(0, REPAIR_SCAN_LIMIT);
  if (missing.length === 0) return 0;
  const daysByMatch = await evidencedDaysByMatch(
    supabase,
    missing.map((m) => m.id),
  );

  let repaired = 0;
  let attempts = 0;
  for (const c of missing) {
    const breakdown = computeSeatReward(daysByMatch.get(c.id) ?? []);
    if (breakdown.days < SEAT_MIN_CHECKIN_DAYS) continue;
    if (attempts >= limit) break;
    attempts++;
    const amount = await holdSeatReward(supabase, {
      matchId: c.id,
      orderId: c.paid_order_id,
      testerUserId: c.tester_user_id,
      breakdown,
    });
    if (amount > 0) repaired++;
  }
  return repaired;
}

/**
 * 보정 2: released 인데 원장 적립 행이 없는 보상 → 적립 (멱등 — 부분 unique).
 * 서브리퀘스트 상한 등으로 지급 전이만 되고 적립이 빠진 경우의 복구.
 */
export async function repairReleasedWithoutEarn(
  supabase: SupabaseClient,
  limit: number,
): Promise<number> {
  const { data: rewards } = await supabase
    .from("seat_rewards")
    .select("id, match_id, tester_user_id, amount")
    .eq("status", "released")
    .order("settled_at", { ascending: false })
    .limit(200);
  const rows = rewards ?? [];
  if (rows.length === 0) return 0;
  const { data: earned } = await supabase
    .from("credits_ledger")
    .select("ref_id")
    .eq("type", "earn")
    .eq("ref_type", PAID_SEAT_LEDGER_REF)
    .in(
      "ref_id",
      rows.map((r) => r.match_id),
    );
  const have = new Set((earned ?? []).map((e) => e.ref_id));

  let repaired = 0;
  for (const r of rows.filter((x) => !have.has(x.match_id)).slice(0, limit)) {
    const ledger = await appendLedger(supabase, {
      userId: r.tester_user_id,
      amount: r.amount,
      type: "earn",
      refType: PAID_SEAT_LEDGER_REF,
      refId: r.match_id,
      description: "유료 시트 보상 확정 (보정)",
    });
    if (ledger.ok && !ledger.duplicate) repaired++;
  }
  return repaired;
}

/**
 * 출시 보너스: 앱 상태가 "출시 완료"인 주문의 released 시트 테스터에게 +100 (시트당 1회, 멱등).
 * @returns 지급 건수와 남은 대상 수
 */
export async function grantLaunchBonuses(
  supabase: SupabaseClient,
  limit: number,
): Promise<{ granted: number; remaining: number }> {
  const { data: orders } = await supabase
    .from("paid_tester_orders")
    .select("id, apps!inner(name, status)")
    .eq("apps.status", "launched")
    .order("id", { ascending: true })
    .limit(200);
  const launched = (orders ?? []) as unknown as Array<{ id: number; apps: { name: string } }>;
  if (launched.length === 0) return { granted: 0, remaining: 0 };
  const appNameByOrder = new Map(launched.map((o) => [o.id, o.apps.name]));

  const pending = await findUnpaidLaunchBonuses(supabase, [...appNameByOrder.keys()]);
  let granted = 0;
  for (const r of pending.slice(0, limit)) {
    const ledger = await appendLedger(supabase, {
      userId: r.tester_user_id,
      amount: SEAT_REWARDS.launch,
      type: "earn",
      refType: PAID_SEAT_LAUNCH_LEDGER_REF,
      refId: r.match_id,
      description: "앱 정식 출시 보너스",
    });
    if (!ledger.ok || ledger.duplicate) continue;
    granted++;
    await createNotification({
      userId: r.tester_user_id,
      type: "seat_reward",
      title: `🎉 출시 보너스 +${SEAT_REWARDS.launch} 크레딧`,
      body: `테스트에 참여한 "${appNameByOrder.get(r.order_id) ?? "앱"}"이 정식 출시되었습니다. 덕분입니다!`,
      link: "/credits",
    });
  }
  return { granted, remaining: Math.max(0, pending.length - limit) };
}

type LaunchBonusTarget = { match_id: number; order_id: number; tester_user_id: number };

const LAUNCH_SCAN_PAGE = 500;
const LAUNCH_SCAN_MAX_PAGES = 4;

/**
 * 출시된 앱 주문의 지급 확정(released) 시트 중 출시 보너스 원장 행이 없는 것.
 * 페이지 단위로 훑어 미지급분이 나오는 첫 페이지를 돌려준다 — 이미 지급한 앞쪽 시트가 뒤쪽을 가리지 않게.
 */
async function findUnpaidLaunchBonuses(
  supabase: SupabaseClient,
  orderIds: number[],
): Promise<LaunchBonusTarget[]> {
  for (let page = 0; page < LAUNCH_SCAN_MAX_PAGES; page++) {
    const from = page * LAUNCH_SCAN_PAGE;
    const { data: rewards } = await supabase
      .from("seat_rewards")
      .select("match_id, order_id, tester_user_id")
      .eq("status", "released")
      .in("order_id", orderIds)
      .order("id", { ascending: true })
      .range(from, from + LAUNCH_SCAN_PAGE - 1);
    const rows = (rewards ?? []) as LaunchBonusTarget[];
    if (rows.length === 0) return [];

    const { data: paid, error } = await supabase
      .from("credits_ledger")
      .select("ref_id")
      .eq("type", "earn")
      .eq("ref_type", PAID_SEAT_LAUNCH_LEDGER_REF)
      .in(
        "ref_id",
        rows.map((r) => r.match_id),
      );
    // 지급 여부를 모르면 이번 실행은 건너뛴다 (원장 unique 가 중복 지급은 막지만 알림이 중복된다)
    if (error) return [];
    const have = new Set((paid ?? []).map((p) => p.ref_id));
    const unpaid = rows.filter((r) => !have.has(r.match_id));
    if (unpaid.length > 0 || rows.length < LAUNCH_SCAN_PAGE) return unpaid;
  }
  return [];
}
