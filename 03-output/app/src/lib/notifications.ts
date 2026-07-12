/**
 * 인앱 알림 생성 헬퍼.
 * 항상 admin client 로 INSERT — 서비스 로직에서 직접 호출.
 * 실패해도 메인 요청을 막지 않도록 void 로 호출하거나 try/catch.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NotificationType =
  | "match_new"
  | "match_reminder"
  | "match_completed"
  | "match_penalized"
  | "comment_new"
  | "post_comment"
  | "boost_expiring"
  | "boost_expired";

type Args = {
  userId: number;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
};

export async function createNotification(args: Args): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("notifications").insert({
      user_id: args.userId,
      type: args.type,
      title: args.title,
      body: args.body.slice(0, 300),
      link: args.link ?? null,
    });
    if (error) console.error("[notification] insert failed", error.message);
  } catch (e) {
    console.error("[notification] exception", e);
  }
}
