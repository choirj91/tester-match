import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NOTICE_CATEGORY } from "@/lib/validators/post";

export const runtime = "edge";

/**
 * GET /api/notices/unread — 안 읽은 공지 수.
 * 비로그인은 읽음 추적 불가 → 0 반환 (배지 미표시).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ unread: 0 });

  const supabase = createSupabaseAdminClient();

  const { data: notices } = await supabase
    .from("posts")
    .select("id")
    .eq("category", NOTICE_CATEGORY)
    .is("deleted_at", null);

  const noticeIds = (notices ?? []).map((n) => n.id);
  if (noticeIds.length === 0) return NextResponse.json({ unread: 0 });

  const { data: reads } = await supabase
    .from("post_reads")
    .select("post_id")
    .eq("user_id", user.id)
    .in("post_id", noticeIds);

  const readSet = new Set((reads ?? []).map((r) => r.post_id));
  const unread = noticeIds.filter((id) => !readSet.has(id)).length;

  return NextResponse.json({ unread });
}
