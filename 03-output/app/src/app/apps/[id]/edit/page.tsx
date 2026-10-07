import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { EditAppForm } from "./edit-app-form";

type Props = { params: Promise<{ id: string }> };

export default async function EditAppPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/apps/${id}/edit`);
  }

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select(
      "id, name, short_description, store_invite_url, web_invite_url, google_group_url, required_testers, status",
    )
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!app) notFound();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-5 pt-12 pb-[88px]">
        <Link
          href={`/apps/${app.id}`}
          className="inline-flex min-h-11 items-center text-sm text-ink-700 hover:text-accent-600"
        >
          ← 앱 상세
        </Link>
        <h1 className="mt-2 font-display text-h1 font-semibold text-ink-900">앱 수정</h1>
        <p className="mt-2 text-[15px] text-ink-700">
          변경한 내용은 매칭 큐에 즉시 반영됩니다.
        </p>

        <div className="mt-8">
          <EditAppForm
            id={app.id}
            initial={{
              nickname: user.nickname,
              name: app.name,
              short_description: app.short_description,
              store_invite_url: app.store_invite_url,
              web_invite_url: app.web_invite_url ?? "",
              google_group_url: app.google_group_url ?? null,
              required_testers: app.required_testers,
              status: app.status as "matching" | "reviewing" | "launched" | "paused",
            }}
          />
        </div>
      </main>
    </>
  );
}
