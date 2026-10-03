import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { currentDayN } from "@/lib/checkin";
import { createNotification } from "@/lib/notifications";
import { applyTrustDelta, CHECKIN_TRUST_DELTA } from "@/lib/trust";
import { runAfterResponse } from "@/lib/wait-until";
import { assignSeatSlot } from "@/lib/paid-seats";
import { completePaidSeat, paidSeatVerdict } from "@/lib/seat-rewards";
import {
  SCREENSHOT_BUCKET,
  SCREENSHOT_MAX_BYTES,
  SCREENSHOT_MIME_TO_EXT,
  screenshotObjectPath,
} from "@/lib/console";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

const TOTAL_DAYS = 14;
/** multipart 본문은 전부 버퍼링되므로 파싱 전에 길이로 먼저 거른다 (스샷 5MB + 여유) */
const MAX_BODY_BYTES = 6 * 1024 * 1024;

/**
 * 일일 체크인. 유료 시트(paid_order_id) 매칭은 스크린샷 1장이 필수이며,
 * 콘솔 슬롯 로그로도 기록되어 구매자가 증빙을 열람한다 (ADR-0012).
 *
 * 완주: 무료 품앗이는 14/14 (신뢰도만). 유료 시트는 14일차 체크인 시 12일 이상이면 완주 →
 * 보상(50 × 일수)은 에스크로에 보류되고 구매자 확정 또는 3일 후 자동 확정으로 지급된다.
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
  let screenshotHash: string | null = null;
  let comment = "";
  if (isPaidSeat) {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, message: "스크린샷은 5MB 이하여야 합니다." },
        { status: 413 },
      );
    }
    const form = await req.formData().catch(() => null);
    const file = form?.get("screenshot");
    const rawComment = form?.get("comment");
    comment = typeof rawComment === "string" ? rawComment.trim().slice(0, 200) : "";
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, message: "유료 시트는 앱 실행 화면 스크린샷 1장이 필요합니다." },
        { status: 400 },
      );
    }
    if (!Object.hasOwn(SCREENSHOT_MIME_TO_EXT, file.type)) {
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

    // 같은 이미지를 날마다 재사용하는 것을 막는다 (매칭 내 SHA-256 중복 거부)
    screenshotHash = await sha256Hex(file);
    const { count: dup } = await supabase
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("screenshot_hash", screenshotHash);
    if ((dup ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, message: "이전에 올린 것과 같은 이미지입니다. 오늘 앱을 실행한 화면을 새로 찍어주세요." },
        { status: 400 },
      );
    }
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

  // 유료 시트: 스크린샷 업로드 + 콘솔 로그. 실패 시 체크인을 되돌려 재시도 가능하게 한다
  if (isPaidSeat && screenshot && match.paid_order_id != null) {
    const stored = await recordSeatScreenshot(supabase, {
      orderId: match.paid_order_id,
      matchId,
      checkinId: checkin.id,
      dayN,
      file: screenshot,
      hash: screenshotHash,
      comment,
      userId: user.id,
      nickname: user.nickname,
    });
    if (!stored) {
      await supabase.from("checkins").delete().eq("id", checkin.id);
      return NextResponse.json(
        { ok: false, message: "스크린샷 저장에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 502 },
      );
    }
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
  const checkedDays = count ?? 0;

  let completed = false;
  let heldAmount = 0;

  if (isPaidSeat && match.paid_order_id != null) {
    // 방금 체크인했으므로 lastCheckinDay = dayN
    if (paidSeatVerdict(dayN, checkedDays, dayN) === "complete") {
      const result = await completePaidSeat(supabase, {
        matchId,
        orderId: match.paid_order_id,
        testerUserId: user.id,
      });
      completed = result.completed;
      heldAmount = result.heldAmount;
    }
  } else if (checkedDays === TOTAL_DAYS) {
    const { data: rows } = await supabase
      .from("matches")
      .update({ status: "completed", day_count: TOTAL_DAYS })
      .eq("id", matchId)
      .eq("status", "active")
      .select("id");
    completed = (rows ?? []).length > 0;
    if (completed) {
      await runAfterResponse(notifyFreeCompletion(supabase, match.app_id, user.id));
    }
  }

  if (!completed) {
    await supabase
      .from("matches")
      .update({ day_count: Math.min(checkedDays || dayN, TOTAL_DAYS) })
      .eq("id", matchId);
  }

  return NextResponse.json({
    ok: true,
    day_n: dayN,
    total_checkins: checkedDays,
    completed,
    held_amount: heldAmount,
  });
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
    hash: string | null;
    comment: string;
    userId: number;
    nickname: string;
  },
): Promise<boolean> {
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
      return false;
    }

    const ext = SCREENSHOT_MIME_TO_EXT[args.file.type];
    const path = screenshotObjectPath(args.orderId, slot.slot_no, args.dayN, ext);
    const { error: upErr } = await supabase.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, args.file, { contentType: args.file.type, upsert: true });
    if (upErr) {
      console.error("[checkins/POST] screenshot upload failed", upErr);
      return false;
    }

    const [{ error: ckErr }, { error: logErr }] = await Promise.all([
      supabase
        .from("checkins")
        .update({ screenshot_url: path, screenshot_hash: args.hash })
        .eq("id", args.checkinId),
      supabase.from("paid_order_logs").upsert(
        {
          order_id: args.orderId,
          slot_id: slot.id,
          day_n: args.dayN,
          status: "done",
          comment: args.comment,
          screenshot_path: path,
          logged_by: args.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slot_id,day_n" },
      ),
    ]);
    if (ckErr || logErr) {
      console.error("[checkins/POST] evidence record failed", ckErr, logErr);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[checkins/POST] recordSeatScreenshot", err);
    return false;
  }
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function notifyFreeCompletion(supabase: Supabase, appId: number, userId: number): Promise<void> {
  const { data: appRow } = await supabase.from("apps").select("name").eq("id", appId).maybeSingle();
  await createNotification({
    userId,
    type: "match_completed",
    title: "14일 완주를 달성했습니다!",
    body: `"${appRow?.name ?? "앱"}" 테스트 14일 완주 완료. 신뢰도 +14 반영. 수고하셨습니다!`,
    link: "/my-tests",
  });
}
