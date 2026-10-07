import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { PostForm } from "./post-form";

export const metadata = { title: "글 쓰기" };

export default async function NewPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/board/new");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-5 pt-12 pb-[88px]">
        <Link href="/board" className="inline-flex min-h-11 items-center text-sm text-ink-700 hover:text-accent-600">
          ← 게시판
        </Link>
        <h1 className="mt-2 font-display text-h1 font-semibold text-ink-900">글 쓰기</h1>
        <div className="mt-8">
          <PostForm isAdmin={user.role === "admin"} />
        </div>
      </main>
    </>
  );
}
