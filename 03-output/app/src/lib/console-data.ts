/**
 * 유료 테스터 콘솔 — 서버 데이터 로더 (admin client 경유, 접근 제어 포함).
 * 구매자는 본인 주문만, 관리자는 전체.
 */

import type { AppUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SCREENSHOT_BUCKET,
  orderDayN,
  type ConsoleLog,
  type ConsoleSlot,
} from "@/lib/console";
import type { PaidOrderStatus } from "@/lib/paid-testers";

const SIGNED_URL_TTL_SEC = 60 * 60;

export type ConsoleOrder = {
  id: number;
  order_code: string;
  app_id: number;
  buyer_user_id: number;
  tester_count: number;
  amount_krw: number;
  status: PaidOrderStatus;
  paid_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  admin_note: string | null;
  created_at: string;
  apps: { id: number; name: string } | null;
  users: { nickname: string; email: string } | null;
};

export type ConsoleLogView = ConsoleLog & { screenshot_url: string | null };

export type ConsoleOrderSummary = ConsoleOrder & {
  dayN: number | null;
  slotCount: number;
  doneCount: number;
};

const ORDER_SELECT =
  "id, order_code, app_id, buyer_user_id, tester_count, amount_krw, status, paid_at, started_at, completed_at, admin_note, created_at, apps(id, name), users(nickname, email)";

export function canAccessOrder(user: AppUser, order: Pick<ConsoleOrder, "buyer_user_id">): boolean {
  return user.role === "admin" || order.buyer_user_id === user.id;
}

export async function listConsoleOrders(user: AppUser): Promise<ConsoleOrderSummary[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("paid_tester_orders")
    .select(ORDER_SELECT)
    .neq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(100);
  if (user.role !== "admin") query = query.eq("buyer_user_id", user.id);

  const { data } = await query;
  const orders = (data ?? []) as unknown as ConsoleOrder[];
  if (orders.length === 0) return [];

  const ids = orders.map((o) => o.id);
  const [{ data: slots }, { data: logs }] = await Promise.all([
    supabase.from("paid_order_slots").select("order_id").in("order_id", ids),
    supabase.from("paid_order_logs").select("order_id, status").in("order_id", ids),
  ]);

  const slotCount = new Map<number, number>();
  for (const s of slots ?? []) slotCount.set(s.order_id, (slotCount.get(s.order_id) ?? 0) + 1);
  const doneCount = new Map<number, number>();
  for (const l of logs ?? []) {
    if (l.status === "done") doneCount.set(l.order_id, (doneCount.get(l.order_id) ?? 0) + 1);
  }

  const now = new Date();
  return orders.map((o) => ({
    ...o,
    dayN: orderDayN(o.started_at, now),
    slotCount: slotCount.get(o.id) ?? 0,
    doneCount: doneCount.get(o.id) ?? 0,
  }));
}

export type ConsoleOrderDetail = {
  order: ConsoleOrder;
  slots: ConsoleSlot[];
  logs: ConsoleLogView[];
  dayN: number | null;
  isAdmin: boolean;
};

export async function loadConsoleOrder(
  orderId: number,
  user: AppUser,
): Promise<ConsoleOrderDetail | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("paid_tester_orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  const order = data as unknown as ConsoleOrder | null;
  if (!order || !canAccessOrder(user, order)) return null;

  const [{ data: slotRows }, { data: logRows }] = await Promise.all([
    supabase
      .from("paid_order_slots")
      .select("id, slot_no, label")
      .eq("order_id", orderId)
      .order("slot_no"),
    supabase
      .from("paid_order_logs")
      .select("id, slot_id, day_n, status, comment, screenshot_path, updated_at")
      .eq("order_id", orderId),
  ]);
  const slots = (slotRows ?? []) as ConsoleSlot[];
  const logs = (logRows ?? []) as ConsoleLog[];

  const paths = logs.map((l) => l.screenshot_path).filter((p): p is string => !!p);
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SEC);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
    }
  }

  return {
    order,
    slots,
    logs: logs.map((l) => ({
      ...l,
      screenshot_url: l.screenshot_path ? (urlByPath.get(l.screenshot_path) ?? null) : null,
    })),
    dayN: orderDayN(order.started_at),
    isAdmin: user.role === "admin",
  };
}

/** tester_count 만큼 슬롯 보장 (멱등 — 이미 있으면 건너뜀). 개시 시·콘솔에서 호출. */
export async function ensureOrderSlots(orderId: number): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { data: order } = await supabase
    .from("paid_tester_orders")
    .select("tester_count")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return 0;

  const rows = Array.from({ length: order.tester_count }, (_, i) => ({
    order_id: orderId,
    slot_no: i + 1,
    label: `테스터 ${i + 1}`,
  }));
  const { error } = await supabase
    .from("paid_order_slots")
    .upsert(rows, { onConflict: "order_id,slot_no", ignoreDuplicates: true });
  if (error) console.error("[console] ensureOrderSlots failed", error);
  return rows.length;
}
