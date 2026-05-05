import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { AppForm } from "./app-form";

export const metadata = { title: "앱 등록" };

export default async function NewAppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/apps/new");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href="/apps"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← 내 앱
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">앱 등록</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Google Play Closed Testing 12명 매칭을 시작합니다. 등록 즉시 매칭 큐에 진입합니다.
        </p>

        <div className="mt-8">
          <AppForm initialNickname={user.nickname} email={user.email} />
        </div>
      </main>
    </>
  );
}
