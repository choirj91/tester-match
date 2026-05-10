import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EditPostForm } from "./edit-post-form";

export const runtime = 'edge';

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/board/${id}/edit`);
  }
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id, category, title, body, author_user_id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!post || post.author_user_id !== user.id) notFound();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href={`/board/${post.id}`} className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 글 보기
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">글 수정</h1>
        <div className="mt-8">
          <EditPostForm
            id={post.id}
            initial={{ category: post.category, title: post.title, body: post.body }}
          />
        </div>
      </main>
    </>
  );
}
