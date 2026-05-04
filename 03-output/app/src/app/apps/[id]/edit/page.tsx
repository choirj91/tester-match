import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  const supabase = await createSupabaseServerClient();
  const { data: app } = await supabase
    .from("apps")
    .select(
      "id, name, short_description, store_invite_url, web_invite_url, required_testers, status",
    )
    .eq("id", appId)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!app) notFound();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={`/apps/${app.id}`}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← 앱 상세
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">앱 수정</h1>
        <p className="mt-2 text-sm text-neutral-600">
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
              required_testers: app.required_testers,
              status: app.status as "matching" | "paused" | "completed",
            }}
          />
        </div>
      </main>
    </>
  );
}
