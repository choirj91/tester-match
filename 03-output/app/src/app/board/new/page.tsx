import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { PostForm } from "./post-form";

export const runtime = 'edge';

export const metadata = { title: "글 쓰기" };

export default async function NewPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/board/new");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/board" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 게시판
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">글 쓰기</h1>
        <div className="mt-8">
          <PostForm />
        </div>
      </main>
    </>
  );
}
