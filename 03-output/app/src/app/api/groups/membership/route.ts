import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  addUserToTesterGroup,
  isGroupMember,
  isGroupsAutoJoinEnabled,
} from "@/lib/google-groups";
import { TESTER_GROUP_EMAIL, TESTER_GROUP_URL } from "@/lib/tester-group";

export const runtime = "edge";

/**
 * GET /api/groups/membership — 본인 그룹 가입 상태 실시간 확인.
 * live: Directory API 실시간 확인 결과 (null = 확인 불가 → DB 기록 기준)
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("users")
    .select("groups_joined_at")
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
  });
}

/**
 * POST /api/groups/membership — 그룹 가입 재시도.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
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
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("users")
      .update({ groups_joined_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true, joined: live === true });
}
