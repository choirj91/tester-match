import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { NotificationList } from "./notification-list";

export const runtime = "edge";

export const metadata = { title: "알림 | Tester Match" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, is_read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // 페이지 로드 시 전체 읽음 처리
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-xl font-bold text-neutral-900">알림</h1>
      <NotificationList notifications={data ?? []} />
    </main>
  );
}
