import { Megaphone, Plus } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALL_POST_CATEGORIES, NOTICE_CATEGORY } from "@/lib/validators/post";
import { AdminBadge } from "@/components/admin-badge";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";

export const metadata = { title: "게시판" };

type Props = { searchParams: Promise<{ category?: string }> };

export default async function BoardPage({ searchParams }: Props) {
  const user = await getCurrentUser();

  const { category } = await searchParams;
  const activeCategory =
    category && (ALL_POST_CATEGORIES as readonly string[]).includes(category) ? category : null;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("posts")
    .select(
      "id, category, title, view_count, created_at, author_user_id, users_public_profile!posts_author_user_id_fkey!inner(nickname)",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (activeCategory) query = query.eq("category", activeCategory);
  else query = query.neq("category", NOTICE_CATEGORY); // 공지는 상단 고정 섹션에서 별도 표시

  const { data: posts } = await query;

  // 공지 상단 고정 (필터 없을 때만, 최신 5개)
  const { data: notices } = activeCategory
    ? { data: [] as NonNullable<typeof posts> }
    : await supabase
        .from("posts")
        .select(
          "id, category, title, view_count, created_at, author_user_id, users_public_profile!posts_author_user_id_fkey!inner(nickname)",
        )
        .eq("category", NOTICE_CATEGORY)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);

  // 공지 필터로 진입 시 → 목록의 공지 전체 읽음 처리
  if (user && activeCategory === NOTICE_CATEGORY && (posts ?? []).length > 0) {
    await supabase.from("post_reads").upsert(
      (posts ?? []).map((p) => ({ user_id: user.id, post_id: p.id })),
      { onConflict: "user_id,post_id", ignoreDuplicates: true },
    );
  }

  // 이번 주 인기글 TOP 3 — 조회수 + 댓글수×5 (필터 없을 때만 표시)
  let hotPosts: { id: number; title: string; category: string; score: number }[] = [];
  if (!activeCategory) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("posts")
      .select("id, title, category, view_count, comments(count)")
      .neq("category", NOTICE_CATEGORY)
      .is("deleted_at", null)
      .gte("created_at", sevenDaysAgo)
      .limit(200);
    hotPosts = (recent ?? [])
      .map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        score:
          (p.view_count ?? 0) +
          ((p.comments as unknown as { count: number }[])?.[0]?.count ?? 0) * 5,
      }))
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // 관리자 댓글이 달린 게시물 집합 (제목 옆 배지용)
  const postIds = (posts ?? []).map((p) => p.id);
  let adminCommentedPostIds = new Set<number>();
  if (postIds.length > 0) {
    const { data: adminComments } = await supabase
      .from("comments")
      .select("post_id, users_public_profile!inner(role)")
      .in("post_id", postIds)
      .eq("users_public_profile.role", "admin")
      .is("deleted_at", null);
    adminCommentedPostIds = new Set((adminComments ?? []).map((c) => c.post_id));
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-5 pt-12 pb-[88px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">게시판</h1>
            <p className="mt-2 text-[15px] text-ink-700">
              수익 인증, 개발기, 실패담 — 앱 만드는 사람들의 진짜 이야기를 나눕니다.
            </p>
          </div>
          <ButtonLink href="/board/new" size="sm">
            <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />글 쓰기
          </ButtonLink>
        </header>

        <nav aria-label="게시판 분류" className="mt-6 flex flex-wrap items-center gap-2">
          <FilterChip href="/board" label="전체" active={!activeCategory} />
          {ALL_POST_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              href={`/board?category=${encodeURIComponent(c)}`}
              label={c}
              active={activeCategory === c}
            />
          ))}
        </nav>

        {/* 공지 상단 고정 */}
        {(notices ?? []).length > 0 && (
          <ul className="m-0 mt-6 list-none divide-y divide-ink-200 border border-ink-900 bg-surface-1 p-0">
            {(notices ?? []).map((n) => (
              <li key={n.id}>
                <Link
                  href={`/board/${n.id}`}
                  className="flex items-center gap-3 px-5 py-3 no-underline hover:bg-white"
                >
                  <Megaphone className="size-4 shrink-0 text-ink-900" strokeWidth={1.8} aria-label="공지" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-900">
                    {n.title}
                  </span>
                  <AdminBadge className="shrink-0" />
                  <span className="shrink-0 font-mono text-xs text-ink-600 tabular-nums">
                    {new Date(n.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* 이번 주 인기글 */}
        {hotPosts.length > 0 && (
          <section className="mt-8 border-t-[1.5px] border-ink-900 pt-3">
            <h2 className="m-0 text-sm font-bold text-ink-900">이번 주 인기글</h2>
            <ol className="m-0 mt-1 list-none divide-y divide-ink-200 p-0">
              {hotPosts.map((h, i) => (
                <li key={h.id}>
                  <Link
                    href={`/board/${h.id}`}
                    className="flex items-center gap-3 py-3 no-underline hover:text-accent-600"
                  >
                    <span className="shrink-0 font-mono text-sm font-medium text-accent-600 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Badge tone="outline" className="shrink-0">
                      {h.category}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-900">
                      {h.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mt-8">
          {posts && posts.length > 0 ? (
            <ul className="m-0 list-none divide-y divide-ink-200 border-y border-ink-900 p-0">
              {posts.map((post) => {
                const author = Array.isArray(post.users_public_profile)
                  ? post.users_public_profile[0]
                  : post.users_public_profile;
                return (
                  <li key={post.id}>
                    <Link
                      href={`/board/${post.id}`}
                      className="flex flex-col gap-1.5 px-1 py-4 no-underline hover:bg-surface-1 sm:flex-row sm:items-center sm:gap-4 sm:px-3"
                    >
                      <Badge tone="outline" className="shrink-0 self-start sm:self-auto">
                        {post.category}
                      </Badge>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-[15px] font-medium text-ink-900">
                          {post.title}
                        </span>
                        {adminCommentedPostIds.has(post.id) && (
                          <Badge tone="ink" className="shrink-0">
                            관리자 답변
                          </Badge>
                        )}
                      </span>
                      <span className="shrink-0 text-[13px] text-ink-600">
                        {author?.nickname ?? "—"}
                        {" · "}
                        <span className="tabular">{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                        {" · "}
                        조회 <span className="tabular">{post.view_count}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="아직 글이 없습니다."
              description="첫 글을 작성해보세요."
              action={<ButtonLink href="/board/new">글 쓰기</ButtonLink>}
            />
          )}
        </div>
      </main>
    </>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-11 items-center px-4 text-sm font-medium no-underline transition-colors ${
        active
          ? "bg-ink-900 text-white"
          : "border border-ink-900 bg-white text-ink-900 hover:bg-surface-1"
      }`}
    >
      {label}
    </Link>
  );
}
