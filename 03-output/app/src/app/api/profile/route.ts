import { NextResponse } from "next/server";
import { releasePaidSeat } from "@/lib/paid-seats";
import { ZodError } from "zod";
import { ProfileUpdateSchema } from "@/lib/validators/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let payload;
  try {
    payload = ProfileUpdateSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { ok: false, message: err.issues[0]?.message ?? "잘못된 요청" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 요청" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      nickname: payload.nickname,
      ...(payload.kakao_nickname !== undefined
        ? { kakao_nickname: payload.kakao_nickname === "" ? null : payload.kakao_nickname }
        : {}),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile/PATCH]", error);
    return NextResponse.json({ ok: false, message: "수정 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * 회원 탈퇴 (F-AUTH-04).
 * - public.users: status='withdrawn', deleted_at=now(), email/nickname 익명화
 * - 진행 중 매칭은 'opted_out' 으로 일괄 전환 (테스터 측), apps 는 'deleted'
 * - auth.users 는 Supabase Admin Auth API 로 영구 삭제
 * - 현재 세션 signOut → 클라이언트 redirect 는 호출자가 처리
 *
 * 결제 기록(payments) / 감사 로그(audit_logs) 는 전자상거래법 5년 보관 의무로 보존.
 * 익명화된 users row 와 ID 로만 연결.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const anonEmail = `withdrawn-${user.id}@deleted.local`;

  // 0) 유료 테스터 정산이 걸려 있으면 탈퇴 불가 — 테스터 보상·구매자 환불이 끊기지 않도록
  const [{ count: openOrders }, { count: pendingRewards }] = await Promise.all([
    admin
      .from("paid_tester_orders")
      .select("id", { count: "exact", head: true })
      .eq("buyer_user_id", user.id)
      .in("status", ["paid", "in_progress"]),
    admin
      .from("seat_rewards")
      .select("id", { count: "exact", head: true })
      .eq("tester_user_id", user.id)
      .in("status", ["held", "disputed"]),
  ]);
  if ((openOrders ?? 0) > 0 || (pendingRewards ?? 0) > 0) {
    return NextResponse.json(
      {
        ok: false,
        message:
          (openOrders ?? 0) > 0
            ? "진행 중인 유료 테스터 주문이 있어 탈퇴할 수 없습니다. 주문 종료 후 다시 시도하거나 문의해주세요."
            : "확정 대기 중인 보상이 있어 탈퇴할 수 없습니다. 지급(최대 3일) 후 다시 시도해주세요.",
      },
      { status: 409 },
    );
  }

  // 1) 본인 앱 → 'deleted'
  await admin.from("apps").update({ status: "deleted" }).eq("owner_user_id", user.id);

  // 2) 진행중 본인 매칭 → 'opted_out' (테스터 측). 유료 시트는 슬롯을 비워 교체 테스터가 받게 한다
  const { data: paidSeatMatches } = await admin
    .from("matches")
    .select("id")
    .eq("tester_user_id", user.id)
    .in("status", ["pending", "active"])
    .not("paid_order_id", "is", null);
  await admin
    .from("matches")
    .update({
      status: "opted_out",
      opted_out_at: now,
      opt_out_reason: "회원 탈퇴",
    })
    .eq("tester_user_id", user.id)
    .in("status", ["pending", "active"]);
  for (const m of paidSeatMatches ?? []) {
    await releasePaidSeat(admin, m.id);
  }

  // 3) public.users 익명화 + 탈퇴 표시
  await admin
    .from("users")
    .update({
      status: "withdrawn",
      deleted_at: now,
      email: anonEmail,
      nickname: "탈퇴회원",
      google_id: null,
    })
    .eq("id", user.id);

  // 4) auth.users 영구 삭제 (Supabase Admin Auth)
  try {
    await admin.auth.admin.deleteUser(user.authUserId);
  } catch (err) {
    console.error("[profile/DELETE] auth.admin.deleteUser failed", err);
    // public.users 익명화는 이미 완료. auth.users 정리 실패는 운영 후속 처리.
  }

  // 5) 현재 세션 종료
  const session = await createSupabaseServerClient();
  await session.auth.signOut();

  return NextResponse.json({ ok: true });
}
