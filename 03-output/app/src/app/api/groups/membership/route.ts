import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addUserToTesterGroup,
  isGroupMember,
  isGroupsAutoJoinEnabled,
} from "@/lib/google-groups";
import {
  TESTER_GROUP_EMAIL,
  TESTER_GROUP_URL,
  PLAY_GROUP_EMAIL,
  PLAY_GROUP_JOIN_URL,
} from "@/lib/tester-group";

export const runtime = "edge";

/**
 * GET /api/groups/membership — 본인 그룹 상태.
 * - 내부(자동) 그룹: Directory API 실시간 확인
 * - Play 그룹(consumer): API 없음 → 자가확인 기록 반환
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("users")
    .select("groups_joined_at, play_group_joined_at")
    .eq("id", user.id)
    .maybeSingle();

  const live = isGroupsAutoJoinEnabled() ? await isGroupMember(user.email) : null;

  // 실시간 확인이 DB와 어긋나면 DB 보정 (수동 탈퇴 등)
  if (live === false && data?.groups_joined_at) {
    await supabase.from("users").update({ groups_joined_at: null }).eq("id", user.id);
  } else if (live === true && !data?.groups_joined_at) {
    await supabase
      .from("users")
      .update({ groups_joined_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  const joined = live !== null ? live : !!data?.groups_joined_at;

  return NextResponse.json({
    ok: true,
    joined,
    live: live !== null,
    joined_at: data?.groups_joined_at ?? null,
    group_email: TESTER_GROUP_EMAIL,
    group_url: TESTER_GROUP_URL,
    // Play 테스터 자격 그룹 (자가확인)
    play_joined: !!data?.play_group_joined_at,
    play_group_email: PLAY_GROUP_EMAIL,
    play_group_join_url: PLAY_GROUP_JOIN_URL,
  });
}

/**
 * POST /api/groups/membership
 * body 없음        → 내부 그룹 가입 재시도 (기존 동작)
 * { play: true }   → Play 그룹 가입 자가확인 저장
 * { play: false }  → Play 그룹 자가확인 해제
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { play?: boolean } = {};
  try {
    body = (await req.json()) as { play?: boolean };
  } catch {
    // body 없음 — 내부 그룹 재시도로 처리
  }

  const supabase = createSupabaseAdminClient();

  if (typeof body.play === "boolean") {
    await supabase
      .from("users")
      .update({ play_group_joined_at: body.play ? new Date().toISOString() : null })
      .eq("id", user.id);
    return NextResponse.json({ ok: true, play_joined: body.play });
  }

  if (!isGroupsAutoJoinEnabled()) {
    return NextResponse.json(
      { ok: false, message: "그룹 자동 가입이 아직 설정되지 않았습니다." },
      { status: 503 },
    );
  }

  await addUserToTesterGroup(user.email);
  const live = await isGroupMember(user.email);

  if (live) {
    await supabase
      .from("users")
      .update({ groups_joined_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true, joined: live === true });
}
