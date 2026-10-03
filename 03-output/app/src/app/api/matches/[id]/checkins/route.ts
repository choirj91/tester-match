import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { currentDayN } from "@/lib/checkin";
import { sendEmail } from "@/lib/email";
import { matchCompletedEmail } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications";
import { applyTrustDelta, CHECKIN_TRUST_DELTA } from "@/lib/trust";
import { PAID_SEAT_LEDGER_REF, appendLedger } from "@/lib/credits";
import { PAID_SEAT_REWARD, assignSeatSlot } from "@/lib/paid-seats";
import {
  SCREENSHOT_BUCKET,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MIME_TO_EXT,
  screenshotObjectPath,
} from "@/lib/console";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

const TOTAL_DAYS = 14;

/**
 * 일일 체크인. 유료 시트(paid_order_id) 매칭은 스크린샷 1장이 필수이며,
 * 콘솔 슬롯 로그로도 기록되어 구매자가 증빙을 열람한다 (ADR-0012).
 * 완주 보상: 유료 시트 700 크레딧(기프티콘 교환 가능), 무료 품앗이는 신뢰도만.
 */
export async function POST(req: Request, { params }: Ctx) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) {
    return NextResponse.json({ ok: false, message: "잘못된 ID" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: match, error: mErr } = await supabase
    .from("matches")
    .select("id, app_id, tester_user_id, status, opted_in_at, paid_order_id")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !match) {
    return NextResponse.json({ ok: false, message: "매칭을 찾을 수 없습니다." }, { status: 404 });
  }
  if (match.tester_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  if (match.status !== "active") {
    return NextResponse.json({ ok: false, message: "활성 매칭이 아닙니다." }, { status: 409 });
  }
  if (!match.opted_in_at) {
    return NextResponse.json(
      { ok: false, message: "옵트인 시각 정보가 없습니다." },
      { status: 500 },
    );
  }

  const dayN = currentDayN(match.opted_in_at);
  if (dayN === 0) {
    return NextResponse.json(
      { ok: false, message: "체크인 가능 기간이 지났습니다." },
      { status: 409 },
    );
  }

  const isPaidSeat = match.paid_order_id != null;

  // 유료 시트: 스크린샷 필수 — INSERT 전에 검증해 실패 시 체크인 자체가 남지 않게 한다
  let screenshot: File | null = null;
  if (isPaidSeat) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("screenshot");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, message: "유료 시트는 앱 실행 화면 스크린샷 1장이 필요합니다." },
        { status: 400 },
      );
    }
    if (!SCREENSHOT_MIME_TO_EXT[file.type]) {
      return NextResponse.json(
        { ok: false, message: "PNG·JPEG·WebP 이미지만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    if (file.size > SCREENSHOT_MAX_BYTES) {
      return NextResponse.json(
        { ok: false, message: "스크린샷은 5MB 이하여야 합니다." },
        { status: 400 },
      );
    }
    screenshot = file;
  }

  // 오늘의 체크인 INSERT (UNIQUE: match_id + day_n)
  const { data: checkin, error: insErr } = await supabase
    .from("checkins")
    .insert({ match_id: matchId, day_n: dayN })
    .select("id")
    .single();

  if (insErr || !checkin) {
    if (insErr?.code === "23505") {
      return NextResponse.json(
        { ok: false, message: "오늘은 이미 체크인했습니다." },
        { status: 409 },
      );
    }
    console.error("[checkins/POST]", insErr);
    return NextResponse.json({ ok: false, message: "체크인 실패" }, { status: 500 });
  }

  // 유료 시트: 스크린샷 업로드 + 콘솔 로그. 실패해도 체크인은 유지 (로그만)
  if (isPaidSeat && screenshot && match.paid_order_id != null) {
    await recordSeatScreenshot(supabase, {
      orderId: match.paid_order_id,
      matchId,
      checkinId: checkin.id,
      dayN,
      file: screenshot,
      userId: user.id,
      nickname: user.nickname,
    });
  }

  // 신뢰도 +1 — UNIQUE(match_id, day_n) 통과 시에만 도달 (하루 1회)
  await applyTrustDelta(supabase, {
    userId: user.id,
    delta: CHECKIN_TRUST_DELTA,
    reason: "reward.checkin",
    refType: "match",
    refId: matchId,
  });

  const { count } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if (count === TOTAL_DAYS) {
    await supabase
      .from("matches")
      .update({ status: "completed", day_count: TOTAL_DAYS })
      .eq("id", matchId)
      .eq("status", "active");

    const reward = isPaidSeat ? PAID_SEAT_REWARD : 0;
    if (reward > 0) {
      const ledger = await appendLedger(supabase, {
        userId: user.id,
        amount: reward,
        type: "earn",
        refType: PAID_SEAT_LEDGER_REF,
        refId: matchId,
        description: "유료 시트 14일 완주 보상",
      });
      if (!ledger.ok) console.error("[checkins/POST] reward failed", ledger.message);
    }
    if (match.paid_order_id != null) {
      await completeOrderIfAllSeatsDone(supabase, match.paid_order_id);
    }

    void notifyCompletion(supabase, {
      appId: match.app_id,
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      reward,
    });
  } else {
    await supabase
      .from("matches")
      .update({ day_count: count ?? dayN })
      .eq("id", matchId);
  }

  return NextResponse.json({ ok: true, day_n: dayN, total_checkins: count });
}

type Supabase = ReturnType<typeof createSupabaseAdminClient>;

async function recordSeatScreenshot(
  supabase: Supabase,
  args: {
    orderId: number;
    matchId: number;
    checkinId: number;
    dayN: number;
    file: File;
    userId: number;
    nickname: string;
  },
): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from("paid_order_slots")
      .select("id, slot_no")
      .eq("match_id", args.matchId)
      .maybeSingle();
    const slot =
      existing ??
      (await assignSeatSlot(supabase, {
        orderId: args.orderId,
        matchId: args.matchId,
        label: args.nickname,
      }).then((s) => (s ? { id: s.slotId, slot_no: s.slotNo } : null)));
    if (!slot) {
      console.error("[checkins/POST] no slot for match", args.matchId);
      return;
    }

    const ext = SCREENSHOT_MIME_TO_EXT[args.file.type];
    const path = screenshotObjectPath(args.orderId, slot.slot_no, args.dayN, ext);
    const { error: upErr } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, args.file, { contentType: args.file.type, upsert: true });
    if (upErr) {
      console.error("[checkins/POST] screenshot upload failed", upErr);
      return;
    }

    await Promise.all([
      supabase.from("checkins").update({ screenshot_url: path }).eq("id", args.checkinId),
      supabase.from("paid_order_logs").upsert(
        {
          order_id: args.orderId,
          slot_id: slot.id,
          day_n: args.dayN,
          status: "done",
          comment: "",
          screenshot_path: path,
          logged_by: args.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slot_id,day_n" },
      ),
    ]);
  } catch (err) {
    console.error("[checkins/POST] recordSeatScreenshot", err);
  }
}

/** 주문의 모든 시트가 완주하면 주문도 완료 처리 (멱등) */
async function completeOrderIfAllSeatsDone(supabase: Supabase, orderId: number): Promise<void> {
  const [{ data: order }, { count }] = await Promise.all([
    supabase.from("paid_tester_orders").select("tester_count").eq("id", orderId).maybeSingle(),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("paid_order_id", orderId)
      .eq("status", "completed"),
  ]);
  if (!order || (count ?? 0) < order.tester_count) return;
  await supabase
    .from("paid_tester_orders")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("status", ["paid", "in_progress"]);
}

async function notifyCompletion(
  supabase: Supabase,
  args: { appId: number; userId: number; nickname: string; email: string; reward: number },
): Promise<void> {
  try {
    const { data: appRow } = await supabase
      .from("apps")
      .select("name")
      .eq("id", args.appId)
      .maybeSingle();
    const appName = appRow?.name ?? "앱";
    if (args.reward > 0) {
      const tmpl = matchCompletedEmail({
        testerNickname: args.nickname,
        appName,
        reward: args.reward,
      });
      await sendEmail({ to: args.email, ...tmpl });
    }
    await createNotification({
      userId: args.userId,
      type: "match_completed",
      title: "14일 완주를 달성했습니다!",
      body:
        args.reward > 0
          ? `"${appName}" 유료 시트 완주 — ${args.reward.toLocaleString("ko-KR")} 크레딧 적립 (기프티콘 교환 가능).`
          : `"${appName}" 테스트 14일 완주 완료. 신뢰도 +14 반영. 수고하셨습니다!`,
      link: args.reward > 0 ? "/credits" : "/my-tests",
    });
  } catch (err) {
    console.error("[checkins/POST] completion notify failed", err);
  }
}
