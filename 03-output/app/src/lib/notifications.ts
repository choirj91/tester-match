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
  | "boost_expired"
  | "group_upgrade"
  | "reward_granted"
  | "weekly_hot";

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

/** 같은 내용을 여러 사용자에게 — 500명씩 배치 INSERT. 성공 건수 반환. */
export async function createNotificationsBulk(
  userIds: number[],
  args: Omit<Args, "userId">,
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: args.type,
    title: args.title,
    body: args.body.slice(0, 300),
    link: args.link ?? null,
  }));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("notifications").insert(batch);
    if (error) {
      console.error("[notification] bulk insert failed", error.message);
      continue;
    }
    inserted += batch.length;
  }
  return inserted;
}
