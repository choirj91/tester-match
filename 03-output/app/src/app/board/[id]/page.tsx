import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CommentList } from "./comment-list";
import { PostActions } from "./post-actions";

export const runtime = 'edge';

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
      url: `https://tester-match.pages.dev/board/${postId}`,
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
      "id, category, title, body, view_count, created_at, updated_at, author_user_id, users_public_profile!inner(nickname, trust_score)",
    )
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!post) notFound();

  const author = Array.isArray(post.users_public_profile)
    ? post.users_public_profile[0]
    : post.users_public_profile;
  const isOwner = !!user && post.author_user_id === user.id;

  const { data: comments } = await supabase
    .from("comments")
    .select(
      "id, body, created_at, updated_at, author_user_id, users_public_profile!inner(nickname, trust_score)",
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
      userInteractionCount: post.view_count,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(postJsonLd) }}
      />
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/board" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 게시판
        </Link>

        <article className="mt-4">
          <span className="rounded-full bg-trust-50 px-2 py-0.5 text-xs font-semibold text-trust-700">
            {post.category}
          </span>
          <h1 className="mt-3 text-3xl font-bold text-neutral-900">{post.title}</h1>
          <p className="mt-2 text-xs text-neutral-500">
            {author?.nickname ?? "—"} · {new Date(post.created_at).toLocaleString("ko-KR")} · 조회{" "}
            <span className="tabular">{post.view_count}</span>
          </p>

          <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed text-neutral-800">
            {post.body}
          </div>

          {isOwner && <PostActions id={post.id} />}
        </article>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-neutral-900">
            댓글 <span className="tabular">{comments?.length ?? 0}</span>
          </h2>
          {user ? (
            <CommentList
              postId={post.id}
              currentUserId={user.id}
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
                };
              })}
            />
          ) : (
            <div className="mt-4">
              <p className="text-sm text-neutral-500">댓글을 작성하려면 로그인이 필요합니다.</p>
              {(comments ?? []).length > 0 && (
                <ul className="mt-4 divide-y divide-neutral-100">
                  {(comments ?? []).slice(0, 20).map((c) => {
                    const a = Array.isArray(c.users_public_profile)
                      ? c.users_public_profile[0]
                      : c.users_public_profile;
                    return (
                      <li key={c.id} className="py-3">
                        <p className="text-xs font-semibold text-neutral-700">
                          {a?.nickname ?? "—"}
                        </p>
                        <p className="mt-1 text-sm text-neutral-800 whitespace-pre-wrap">{c.body}</p>
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
