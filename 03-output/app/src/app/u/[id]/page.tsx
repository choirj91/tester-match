import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { AppCard } from "@/components/ui/app-card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/state";
import { SEAT_TOTAL_DAYS } from "@/lib/seat-reward-rules";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminBadge } from "@/components/admin-badge";

const STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  matching: { label: "모집중", tone: "ink" },
  reviewing: { label: "검수중", tone: "warning" },
  launched: { label: "출시 완료", tone: "success" },
  paused: { label: "일시중지", tone: "outline" },
};

export default async function PublicUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const viewer = await getCurrentUser();
  const supabase = createSupabaseAdminClient();

  // 공개 페이지 — 이메일 등 개인정보는 조회하지 않는다 (닉네임·신뢰도·가입일만)
  const { data: profile } = await supabase
    .from("users")
    .select("id, nickname, trust_score, role, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) notFound();

  const [{ data: apps }, { count: matchCount }, { count: completedCount }] = await Promise.all([
    supabase
      .from("apps")
      .select("id, name, short_description, status, required_testers, created_at")
      .eq("owner_user_id", id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tester_user_id", id),
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("tester_user_id", id)
      .eq("status", "completed"),
  ]);

  const appList = apps ?? [];

  return (
    <>
      <SiteHeader user={viewer} />
      <main className="mx-auto max-w-[880px] px-5 pt-8 pb-14">
        <Link
          href="/stats"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-700 hover:text-accent-600"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
          활동 랭킹
        </Link>

        {/* 프로필 헤더 */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">{profile.nickname}</h1>
          {profile.role === "admin" && <AdminBadge />}
          <span className="font-mono text-sm text-ink-900 tabular-nums">신뢰도 {profile.trust_score}</span>
        </div>
        <p className="m-0 mt-1 text-[13px] text-ink-600">
          <span className="font-mono tabular-nums">{new Date(profile.created_at).toLocaleDateString("ko-KR")}</span> 가입
        </p>

        {/* 활동 요약 */}
        <StatTiles className="mt-8">
          <StatTile rule label="등록 앱" value={<span className="font-mono">{appList.length}</span>} />
          <StatTile rule label="테스트 참여" value={<span className="font-mono">{matchCount ?? 0}</span>} />
          <StatTile
            rule
            label={`${SEAT_TOTAL_DAYS}일 완주`}
            value={<span className="font-mono">{completedCount ?? 0}</span>}
          />
        </StatTiles>

        {/* 등록한 앱 */}
        <section aria-labelledby="apps-heading" className="mt-12 flex flex-col gap-4 border-t border-ink-900 pt-8">
          <h2 id="apps-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
            등록한 앱 <span className="font-mono tabular-nums">{appList.length}</span>개
          </h2>
          {appList.length === 0 ? (
            <EmptyState title="아직 등록한 앱이 없습니다." />
          ) : (
            <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4 p-0">
              {appList.map((a) => {
                const st = STATUS_LABEL[a.status] ?? { label: a.status, tone: "outline" as const };
                return (
                  <li key={a.id} className="flex">
                    <AppCard
                      className="w-full"
                      name={a.name}
                      badges={<Badge tone={st.tone}>{st.label}</Badge>}
                      description={<span className="line-clamp-2">{a.short_description}</span>}
                      meta={`${new Date(a.created_at).toLocaleDateString("ko-KR")} 등록`}
                      action={
                        <ButtonLink
                          href={`/browse/${a.id}`}
                          variant="secondary"
                          size="sm"
                          aria-label={`${a.name} 자세히 보기`}
                        >
                          자세히 보기
                        </ButtonLink>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
