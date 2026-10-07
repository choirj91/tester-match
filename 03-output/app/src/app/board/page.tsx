import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALL_POST_CATEGORIES, NOTICE_CATEGORY } from "@/lib/validators/post";
import { AdminBadge } from "@/components/admin-badge";

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
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">게시판</h1>
            <p className="mt-1 text-sm text-ink-700">
              수익 인증, 개발기, 실패담 — 앱 만드는 사람들의 진짜 이야기를 나눕니다.
            </p>
          </div>
          <Link
            href="/board/new"
            className="bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
          >
            + 글 쓰기
          </Link>
        </header>

        <nav className="mt-6 flex flex-wrap items-center gap-2">
          <FilterChip href="/board" label="전체" active={!activeCategory} />
          {ALL_POST_CATEGORIES.map((c) => (
            <FilterChip
              key={c}
              href={`/board?category=${encodeURIComponent(c)}`}
              label={c === NOTICE_CATEGORY ? `📢 ${c}` : c}
              active={activeCategory === c}
            />
          ))}
        </nav>

        {/* 공지 상단 고정 */}
        {(notices ?? []).length > 0 && (
          <div className="mt-6 overflow-hidden border border-ink-200 bg-surface-1">
            <ul className="divide-y divide-ink-200">
              {(notices ?? []).map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/board/${n.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-1"
                  >
                    <span className="shrink-0 text-sm">📢</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                      {n.title}
                    </span>
                    <AdminBadge className="shrink-0" />
                    <span className="shrink-0 text-xs text-ink-600">
                      {new Date(n.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 이번 주 인기글 */}
        {hotPosts.length > 0 && (
          <div className="mt-6 overflow-hidden border border-accent-600 bg-accent-50">
            <p className="px-5 pt-3 text-xs font-bold text-accent-600">🔥 이번 주 인기글</p>
            <ul className="divide-y divide-ink-200">
              {hotPosts.map((h, i) => (
                <li key={h.id}>
                  <Link
                    href={`/board/${h.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-accent-50"
                  >
                    <span className="shrink-0 text-sm font-bold text-accent-600">{i + 1}</span>
                    <span className="shrink-0 bg-white px-2 py-0.5 text-xs font-semibold text-ink-700">
                      {h.category}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">
                      {h.title}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 overflow-hidden border border-ink-200 bg-white">
          {posts && posts.length > 0 ? (
            <ul className="divide-y divide-ink-200">
              {posts.map((post) => {
                const author = Array.isArray(post.users_public_profile)
                  ? post.users_public_profile[0]
                  : post.users_public_profile;
                return (
                  <li key={post.id}>
                    <Link
                      href={`/board/${post.id}`}
                      className="flex flex-col gap-1 px-5 py-4 transition hover:bg-surface-1 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="shrink-0 bg-surface-1 px-2 py-0.5 text-xs font-semibold text-ink-900">
                        {post.category}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink-900">
                          {post.title}
                        </span>
                        {adminCommentedPostIds.has(post.id) && (
                          <span className="shrink-0 bg-surface-1 px-1.5 py-0.5 text-[9px] font-bold text-ink-900 ring-1 ring-accent-600">
                            🛡 관리자 답변
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-ink-600">
                        {author?.nickname ?? "—"}
                        {" · "}
                        {new Date(post.created_at).toLocaleDateString("ko-KR")}
                        {" · "}
                        조회 <span className="tabular">{post.view_count}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-ink-700">아직 글이 없습니다. 첫 글을 작성해보세요.</p>
            </div>
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
      className={` px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-ink-900 text-white"
          : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-surface-1"
      }`}
    >
      {label}
    </Link>
  );
}
