import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { currentDayN } from "@/lib/checkin";
import { sendEmail } from "@/lib/email";
import { matchCompletedEmail } from "@/lib/email-templates";
import { createNotification } from "@/lib/notifications";

export const runtime = "edge";

type Ctx = { params: Promise<{ id: string }> };

const COMPLETION_REWARD = 800;

export async function POST(_req: Request, { params }: Ctx) {
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
    .select("id, app_id, tester_user_id, status, opted_in_at")
    .eq("id", matchId)
    .maybeSingle();

  if (mErr || !match) {
    return NextResponse.json({ ok: false, message: "매칭을 찾을 수 없습니다." }, { status: 404 });
  }
  if (match.tester_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  if (match.status !== "active") {
    return NextResponse.json(
      { ok: false, message: "활성 매칭이 아닙니다." },
      { status: 409 },
    );
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

  // 오늘의 체크인 INSERT (부분 UNIQUE: match_id + day_n)
  const { error: insErr } = await supabase
    .from("checkins")
    .insert({ match_id: matchId, day_n: dayN });

  if (insErr) {
    if (insErr.code === "23505") {
      return NextResponse.json(
        { ok: false, message: "오늘은 이미 체크인했습니다." },
        { status: 409 },
      );
    }
    console.error("[checkins/POST]", insErr);
    return NextResponse.json({ ok: false, message: "체크인 실패" }, { status: 500 });
  }

  // 14일 모두 완료했는지 확인 → 완주 처리 + 크레딧 적립.
  const { count } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if (count === 14) {
    await supabase
      .from("matches")
      .update({ status: "completed", day_count: 14 })
      .eq("id", matchId);

    // 잔액 + 800 크레딧 적립 (append-only ledger).
    const { data: ledger } = await supabase
      .from("credits_ledger")
      .select("amount")
      .eq("user_id", user.id);
    const currentBalance = (ledger ?? []).reduce((s, r) => s + r.amount, 0);

    const { error: credErr } = await supabase.from("credits_ledger").insert({
      user_id: user.id,
      amount: COMPLETION_REWARD,
      balance_after: currentBalance + COMPLETION_REWARD,
      type: "earn",
      ref_type: "match",
      ref_id: matchId,
      description: "14일 완주 보상",
    });
    if (credErr) {
      console.error("[checkins/POST] credit insert failed", credErr);
    }

    // 완주 알림 메일 (실패해도 무시)
    void (async () => {
      try {
        const { data: appRow } = await supabase
          .from("apps")
          .select("name")
          .eq("id", match.app_id)
          .maybeSingle();
        const appName = appRow?.name ?? "앱";
        const tmpl = matchCompletedEmail({
          testerNickname: user.nickname,
          appName,
          reward: COMPLETION_REWARD,
        });
        await sendEmail({
          to: user.email,
          subject: tmpl.subject,
          html: tmpl.html,
          text: tmpl.text,
        });
        // 인앱 알림
        await createNotification({
          userId: user.id,
          type: "match_completed",
          title: "14일 완주를 달성했습니다!",
          body: `"${appName}" 테스트 14일 완주 완료. 정식 출시 후 보상 안내 예정입니다.`,
          link: "/my-tests",
        });
      } catch (err) {
        console.error("[checkins/POST] completion email failed", err);
      }
    })();
  } else {
    // day_count 갱신 (현재 누적 체크인 수)
    await supabase
      .from("matches")
      .update({ day_count: count ?? dayN })
      .eq("id", matchId);
  }

  return NextResponse.json({ ok: true, day_n: dayN, total_checkins: count });
}
