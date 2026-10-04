import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminNotifyEmail, sendEmail } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { releasePaidSeat } from "@/lib/paid-seats";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";
import { PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { runAfterResponse } from "@/lib/wait-until";

type Ctx = { params: Promise<{ id: string }> };

const REPORT_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * "설치가 안 돼요" 신고 — 구매자가 Play Console 에 테스터 그룹을 등록하지 않는 등
 * 테스터 책임이 아닌 사유로 설치가 불가능할 때, 신뢰도 차감 없이 시트에서 빠진다.
 * 조건: 본인의 활성 유료 시트, 체크인 0회, 참여 후 72시간 이내.
 */
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
  const { data: match } = await supabase
    .from("matches")
    .select("id, app_id, tester_user_id, status, opted_in_at, paid_order_id, checkins(id)")
    .eq("id", matchId)
    .maybeSingle();
  if (!match || match.tester_user_id !== user.id) {
    return NextResponse.json({ ok: false, message: "매칭을 찾을 수 없습니다." }, { status: 404 });
  }
  if (match.status !== "active" || match.paid_order_id == null) {
    return NextResponse.json(
      { ok: false, message: "진행 중인 유료 시트에서만 신고할 수 있습니다." },
      { status: 409 },
    );
  }
  if (((match.checkins ?? []) as unknown[]).length > 0) {
    return NextResponse.json(
      { ok: false, message: "이미 체크인한 시트는 옵트아웃을 이용해주세요." },
      { status: 409 },
    );
  }
  if (!match.opted_in_at || Date.now() - new Date(match.opted_in_at).getTime() > REPORT_WINDOW_MS) {
    return NextResponse.json(
      { ok: false, message: "참여 후 72시간이 지나 신고할 수 없습니다." },
      { status: 409 },
    );
  }

  const { data: moved } = await supabase
    .from("matches")
    .update({
      status: "opted_out",
      opted_out_at: new Date().toISOString(),
      opt_out_reason: "install_blocked",
    })
    .eq("id", matchId)
    .eq("status", "active")
    .select("id");
  if (!moved || moved.length === 0) {
    return NextResponse.json({ ok: false, message: "이미 종료된 매칭입니다." }, { status: 409 });
  }
  await releasePaidSeat(supabase, matchId);

  const { data: app } = await supabase
    .from("apps")
    .select("name, owner_user_id")
    .eq("id", match.app_id)
    .maybeSingle();
  const appName = app?.name ?? "앱";
  const notify = async () => {
    if (app) {
      await createNotification({
        userId: app.owner_user_id,
        type: "seat_issue",
        title: "테스터가 설치할 수 없다고 신고했습니다",
        body: `"${appName}" 유료 시트 테스터가 앱을 설치하지 못했습니다. Play Console 비공개 테스트 트랙에 ${PLAY_GROUP_EMAIL} 그룹이 등록됐는지, 초대 링크가 열리는지 확인해주세요. 시트는 다시 열렸습니다.`,
        link: `/apps/${match.app_id}`,
      });
    }
    await sendEmail({
      to: getAdminNotifyEmail(CONTACT_EMAIL),
      subject: `[Tester Match] 설치 불가 신고 — ${appName}`,
      html: `<p>${user.nickname} 님이 "${appName}" 유료 시트에서 설치 불가를 신고했습니다 (무페널티 해제). 구매자 설정을 확인하세요.</p><p><a href="${SITE_URL}/admin/paid-orders">주문 관리</a></p>`,
      text: `설치 불가 신고 — ${appName} / ${user.nickname}\n${SITE_URL}/admin/paid-orders`,
    });
  };
  await runAfterResponse(notify());

  return NextResponse.json({ ok: true });
}
