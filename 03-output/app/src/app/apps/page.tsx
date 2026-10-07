import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SiteHeader } from "@/components/site-header";
import { Plus } from "lucide-react";
import { PaymentPendingBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";
import { AppStatusBadge } from "./app-status-badge";
import { formatKrw } from "@/lib/credits";
import { PAID_TESTERS_PUBLIC_ORDERING, PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";

export const metadata = { title: "내 앱" };

export default async function AppsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/apps");

  const supabase = createSupabaseAdminClient();
  const { data: apps } = await supabase
    .from("apps")
    .select("id, name, status, short_description, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  // 본인 앱별 active 매칭 수 (참여중)
  const ids = (apps ?? []).map((a) => a.id);
  const counts = new Map<number, number>();
  if (ids.length > 0) {
    const { data: matchRows } = await supabase
      .from("matches")
      .select("app_id")
      .in("app_id", ids)
      .eq("status", "active");
    for (const m of matchRows ?? []) {
      counts.set(m.app_id, (counts.get(m.app_id) ?? 0) + 1);
    }
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-5 pt-12 pb-[88px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">내 앱</h1>
            <p className="mt-2 text-[15px] text-ink-700">
              등록한 앱과 진행 상태를 한 화면에서 관리합니다.
            </p>
          </div>
          <ButtonLink href="/apps/new" size="sm">
            <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />앱 등록
          </ButtonLink>
        </div>

        {user && (
          <Link
            href="/paid-testers"
            className="group mt-8 block border border-ink-900 bg-white px-5 py-4 no-underline hover:bg-surface-1"
          >
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-ink-900">
              테스터가 부족하신가요? — 유료 테스터 투입
              {!PAID_TESTERS_PUBLIC_ORDERING && <PaymentPendingBadge />}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-700">
              회사가 모집·관리하는 커뮤니티 테스터가 1명당{" "}
              <span className="tabular">{formatKrw(PAID_TESTER_PRICE_KRW)}</span>
              원(부가세 포함)에 14일간 매일 스크린샷 체크인. 완주한 시트만 과금됩니다.{" "}
              <span className="group-hover:text-accent-600">→</span>
            </p>
          </Link>
        )}

        <div className="mt-8">
          {apps && apps.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {apps.map((app) => {
                const activeCount = counts.get(app.id) ?? 0;
                return (
                  <li key={app.id}>
                    <Link
                      href={`/apps/${app.id}`}
                      className="block border border-ink-900 bg-white p-5 no-underline hover:bg-surface-1"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="m-0 truncate text-lg font-bold text-ink-900">
                            {app.name}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm text-ink-700">
                            {app.short_description}
                          </p>
                        </div>
                        <AppStatusBadge status={app.status} />
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] text-ink-600 tabular-nums">
                        <span>
                          <strong className="text-ink-900">{activeCount}</strong>명 참여중
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          등록일{" "}
                          {new Date(app.created_at).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                          })}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              title="아직 등록된 앱이 없습니다."
              description="첫 앱을 등록하면 매칭 큐에 진입합니다."
              action={
                <ButtonLink href="/apps/new">
                  <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />앱 등록
                </ButtonLink>
              }
            />
          )}
        </div>
      </main>
    </>
  );
}
