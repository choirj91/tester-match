import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALL_POST_CATEGORIES, NOTICE_CATEGORY } from "@/lib/validators/post";
import { AdminBadge } from "@/components/admin-badge";

export const runtime = 'edge';

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
            <h1 className="text-2xl font-bold text-neutral-900">게시판</h1>
            <p className="mt-1 text-sm text-neutral-600">
              개발자끼리 정보를 나누고 매칭에 대해 이야기합니다.
            </p>
          </div>
          <Link
            href="/board/new"
            className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
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
          <div className="mt-6 overflow-hidden rounded-2xl border border-trust-500/30 bg-trust-50/50 shadow-sm">
            <ul className="divide-y divide-trust-500/10">
              {(notices ?? []).map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/board/${n.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-trust-50"
                  >
                    <span className="shrink-0 text-sm">📢</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                      {n.title}
                    </span>
                    <AdminBadge className="shrink-0" />
                    <span className="shrink-0 text-xs text-neutral-400">
                      {new Date(n.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {posts && posts.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {posts.map((post) => {
                const author = Array.isArray(post.users_public_profile)
                  ? post.users_public_profile[0]
                  : post.users_public_profile;
                return (
                  <li key={post.id}>
                    <Link
                      href={`/board/${post.id}`}
                      className="flex flex-col gap-1 px-5 py-4 transition hover:bg-neutral-50 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="shrink-0 rounded-full bg-trust-50 px-2 py-0.5 text-xs font-semibold text-trust-700">
                        {post.category}
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-neutral-900">
                          {post.title}
                        </span>
                        {adminCommentedPostIds.has(post.id) && (
                          <span className="shrink-0 rounded-full bg-trust-50 px-1.5 py-0.5 text-[9px] font-bold text-trust-700 ring-1 ring-trust-500/30">
                            🛡 관리자 답변
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">
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
              <p className="text-sm text-neutral-600">아직 글이 없습니다. 첫 글을 작성해보세요.</p>
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
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-trust-600 text-white"
          : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
      }`}
    >
      {label}
    </Link>
  );
}
