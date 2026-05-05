import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { OptInButton } from "./opt-in-button";

type Props = { params: Promise<{ id: string }> };

export default async function BrowseDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    const { id } = await params;
    redirect(`/auth/login?next=/browse/${id}`);
  }

  const { id } = await params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: app } = await supabase
    .from("apps")
    .select(
      "id, name, short_description, store_invite_url, web_invite_url, required_testers, status, is_boost, created_at, owner_user_id, users_public_profile!inner(nickname, trust_score)",
    )
    .eq("id", appId)
    .maybeSingle();

  if (!app) notFound();

  // 본인이 이 앱에 이미 active 매칭으로 참여 중인지
  const { data: existingMatch } = await supabase
    .from("matches")
    .select("id")
    .eq("app_id", appId)
    .eq("tester_user_id", user.id)
    .in("status", ["pending", "active"])
    .maybeSingle();

  const owner = Array.isArray(app.users_public_profile)
    ? app.users_public_profile[0]
    : app.users_public_profile;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/browse" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 매칭 가능
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold text-neutral-900">{app.name}</h1>
          {app.is_boost && (
            <span className="shrink-0 rounded-full bg-spark-500 px-3 py-1 text-xs font-bold uppercase text-white">
              BOOST
            </span>
          )}
        </div>

        <p className="mt-3 text-base leading-relaxed text-neutral-700">
          {app.short_description}
        </p>

        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <Stat label="남은 테스터" value={`${app.required_testers}명`} />
          <Stat label="등록자" value={owner?.nickname ?? "—"} />
          <Stat label="신뢰 점수" value={`${owner?.trust_score ?? 50}`} />
          <Stat
            label="등록일"
            value={new Date(app.created_at).toLocaleDateString("ko-KR")}
          />
        </dl>

        <section className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-neutral-900">참여하기</h2>
          <p className="mt-1 text-sm text-neutral-600">
            참여하면 14일 카운트가 시작됩니다. 본인 디바이스에서 아래 링크로 Closed Testing 에 가입하세요.
          </p>

          <div className="mt-5 space-y-3">
            <LinkRow label="안드로이드" url={app.store_invite_url} />
            <LinkRow label="웹 (브라우저)" url={app.web_invite_url} />
          </div>

          <div className="mt-6">
            <OptInButton
              appId={app.id}
              alreadyJoined={!!existingMatch}
              isOwn={app.owner_user_id === user.id}
              isFull={app.required_testers <= 0}
            />
          </div>
        </section>

        <p className="mt-6 text-xs text-neutral-500">
          * 옵트아웃은 언제든 가능하지만 5일 이상 미체크인 시 페널티가 부과됩니다 (F-CHK-06, 추후 활성).
        </p>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-neutral-900 tabular">{value}</dd>
    </div>
  );
}

function LinkRow({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="text-sm text-neutral-400">
        <strong className="font-semibold">{label}:</strong> 미등록
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="shrink-0 text-sm font-semibold text-neutral-700">{label}</span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm text-trust-600 underline hover:text-trust-700"
      >
        {url}
      </a>
    </div>
  );
}
