import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";
import { createNotificationsBulk } from "@/lib/notifications";
import { fetchAll } from "@/lib/fetch-all";
import { NOTICE_CATEGORY } from "@/lib/validators/post";

export const runtime = "edge";

/**
 * 주간 인기글 알림 — "아프니까 사장이다" 쪽지 모델.
 *
 * 매주 월요일 KST 10:00: 최근 7일 게시글 중 인기 점수
 * (조회수 + 댓글수×5) 상위 3편을 뽑아 전 회원에게 인앱 알림 1건 발송.
 * 링크는 1위 글로, 멱등 키는 KST 주차(?hot=YYYY-Www) — 같은 주에
 * 재실행돼도 중복 발송하지 않는다.
 */

/** KST 기준 ISO 주차 문자열 (예: 2026-W33) */
function kstWeekKey(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  // ISO week: 목요일 기준
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const weekKey = kstWeekKey();

  // ── 최근 7일 게시글 + 댓글 수 (공지 제외) ───────────────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, title, category, view_count, comments(count)")
    .neq("category", NOTICE_CATEGORY)
    .is("deleted_at", null)
    .gte("created_at", sevenDaysAgo)
    .limit(500);

  if (error) {
    console.error("[cron/weekly-hot] posts query failed", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const scored = (posts ?? [])
    .map((p) => {
      const commentCount = (p.comments as unknown as { count: number }[])?.[0]?.count ?? 0;
      return { ...p, score: (p.view_count ?? 0) + commentCount * 5, commentCount };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no eligible posts" });
  }

  const top = scored[0];
  const link = `/board/${top.id}?hot=${weekKey}`;

  // ── 멱등 가드: 이번 주차 링크로 이미 발송했으면 스킵 ────────────────
  const { count: already } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("link", link)
    .eq("type", "weekly_hot");
  if ((already ?? 0) > 0) {
    return NextResponse.json({ ok: true, skipped: "already sent this week", weekKey });
  }

  // ── 전 회원 발송 ─────────────────────────────────────────────────────
  const users = await fetchAll<{ id: number }>((from, to) =>
    supabase.from("users").select("id").is("deleted_at", null).order("id").range(from, to),
  );

  const others = scored
    .slice(1)
    .map((p, i) => `${i + 2}위 ${p.title}`)
    .join(" · ");
  const body =
    `"${top.title}" (조회 ${top.view_count ?? 0} · 댓글 ${top.commentCount})` +
    (others ? ` — ${others}` : "");

  const sent = await createNotificationsBulk(
    users.map((u) => u.id),
    {
      type: "weekly_hot",
      title: "📈 이번 주 게시판 인기글",
      body,
      link,
    },
  );

  return NextResponse.json({ ok: true, weekKey, top: top.id, sent });
}

// GitHub Actions cron 은 POST 로 호출 (기존 워크플로우 규약)
export const POST = GET;
