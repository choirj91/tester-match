import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

// GET /api/notifications
// ?count=1  → { count: N } (읽지 않은 알림 수만)
// 기본       → { notifications: [...] }
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const supabase = createSupabaseAdminClient();

  if (searchParams.get("count") === "1") {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    return NextResponse.json({ count: count ?? 0 });
  }

  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ ok: true, notifications: data ?? [] });
}

// PATCH /api/notifications  → 전체 읽음 처리
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return NextResponse.json({ ok: true });
}
