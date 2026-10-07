import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CommentList } from "./comment-list";
import { PostActions } from "./post-actions";
import { AdminBadge } from "@/components/admin-badge";
import { Linkify } from "@/components/linkify";
import { NOTICE_CATEGORY } from "@/lib/validators/post";
import { Badge } from "@/components/ui/badge";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) return {};
  const supabase = createSupabaseAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, title, body, category")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!post) return {};
  const description = (post.body ?? "").replace(/\s+/g, " ").slice(0, 155);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/board/${postId}` },
    openGraph: {
      title: post.title,
      description,
      url: `https://tester-match.knockknock.company/board/${postId}`,
      type: "article",
    },
  };
}

export default async function PostDetailPage({ params }: Props) {
  const user = await getCurrentUser();

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select(
      "id, category, title, body, view_count, created_at, updated_at, author_user_id, users_public_profile!posts_author_user_id_fkey!inner(nickname, trust_score)",
    )
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!post) notFound();

  // 조회수 +1 (원자적 UPDATE) — 이번 열람 반영해 표시
  await supabase.rpc("increment_post_view", { p_post_id: post.id });
  const viewCount = (post.view_count ?? 0) + 1;

  const author = Array.isArray(post.users_public_profile)
    ? post.users_public_profile[0]
    : post.users_public_profile;
  const isOwner = !!user && post.author_user_id === user.id;

  // 공지 상세 열람 시 읽음 기록
  if (user && post.category === NOTICE_CATEGORY) {
    await supabase
      .from("post_reads")
      .upsert(
        { user_id: user.id, post_id: post.id },
        { onConflict: "user_id,post_id", ignoreDuplicates: true },
      );
  }

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, body, created_at, updated_at, author_user_id, users_public_profile!inner(nickname, trust_score, role)",
    )
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const postJsonLd = {
    "@context": "https://schema.org",
    "@type": "DiscussionForumPosting",
    headline: post.title,
    articleBody: post.body,
    datePublished: post.created_at,
    dateModified: post.updated_at,
    author: { "@type": "Person", name: author?.nickname ?? "Tester Match 사용자" },
    articleSection: post.category,
    interactionStatistic: {
      "@type": "InteractionCounter",
      interactionType: "https://schema.org/ViewAction",
      userInteractionCount: viewCount,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(postJsonLd) }}
      />
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-5 pt-12 pb-[88px]">
        <Link href="/board" className="inline-flex min-h-11 items-center text-sm text-ink-700 hover:text-accent-600">
          ← 게시판
        </Link>

        <article className="mt-2">
          <Badge tone="outline">{post.category}</Badge>
          <h1 className="mt-3 font-display text-h1 font-semibold break-words text-ink-900">{post.title}</h1>
          <p className="mt-2 text-[13px] text-ink-600">
            {author?.nickname ?? "—"} ·{" "}
            <span className="tabular">{new Date(post.created_at).toLocaleString("ko-KR")}</span> · 조회{" "}
            <span className="tabular">{viewCount}</span>
          </p>

          <div className="mt-8 border-t border-ink-900 pt-8 text-base leading-[1.8] break-words whitespace-pre-wrap text-ink-900">
            <Linkify text={post.body} />
          </div>

          {isOwner && <PostActions id={post.id} />}
        </article>

        <section className="mt-12 border-t border-ink-900 pt-8">
          <h2 className="m-0 font-display text-h2 font-semibold text-ink-900">
            댓글 <span className="font-mono text-[22px] tabular-nums">{comments?.length ?? 0}</span>
          </h2>
          {user ? (
            <CommentList
              postId={post.id}
              currentUserId={user.id}
              currentUserRole={user.role}
              initialComments={(comments ?? []).map((c) => {
                const a = Array.isArray(c.users_public_profile)
                  ? c.users_public_profile[0]
                  : c.users_public_profile;
                return {
                  id: c.id,
                  body: c.body,
                  created_at: c.created_at,
                  author_user_id: c.author_user_id,
                  author_nickname: a?.nickname ?? "—",
                  author_role: a?.role,
                };
              })}
            />
          ) : (
            <div className="mt-4">
              <p className="text-sm text-ink-700">댓글을 작성하려면 로그인이 필요합니다.</p>
              {(comments ?? []).length > 0 && (
                <ul className="mt-4 divide-y divide-ink-200">
                  {(comments ?? []).slice(0, 20).map((c) => {
                    const a = Array.isArray(c.users_public_profile)
                      ? c.users_public_profile[0]
                      : c.users_public_profile;
                    return (
                      <li key={c.id} className="py-3">
                        <p className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-900">
                          {a?.nickname ?? "—"}
                          {a?.role === "admin" && <AdminBadge />}
                        </p>
                        <p className="mt-1 text-sm text-ink-900 whitespace-pre-wrap"><Linkify text={c.body} /></p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
