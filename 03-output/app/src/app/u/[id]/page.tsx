import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminBadge } from "@/components/admin-badge";

export const runtime = "edge";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  matching: { label: "모집중", cls: "bg-trust-50 text-trust-700" },
  reviewing: { label: "검수중", cls: "bg-amber-100 text-amber-700" },
  launched: { label: "출시 완료", cls: "bg-mint-500/10 text-mint-500" },
  paused: { label: "일시중지", cls: "bg-neutral-100 text-neutral-500" },
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
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/stats" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 활동 랭킹
        </Link>

        {/* 프로필 헤더 */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">{profile.nickname}</h1>
          {profile.role === "admin" && <AdminBadge />}
          <span className="text-sm font-semibold text-spark-500">★{profile.trust_score}</span>
        </div>
        <p className="mt-1 text-xs text-neutral-400">
          {new Date(profile.created_at).toLocaleDateString("ko-KR")} 가입
        </p>

        {/* 활동 요약 */}
        <section className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold tabular text-trust-600">{appList.length}</p>
            <p className="mt-0.5 text-xs text-neutral-500">등록 앱</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold tabular text-neutral-900">{matchCount ?? 0}</p>
            <p className="mt-0.5 text-xs text-neutral-500">테스트 참여</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold tabular text-mint-500">{completedCount ?? 0}</p>
            <p className="mt-0.5 text-xs text-neutral-500">14일 완주</p>
          </div>
        </section>

        {/* 등록한 앱 */}
        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">등록한 앱 {appList.length}개</h2>
          {appList.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
              아직 등록한 앱이 없습니다.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {appList.map((a) => {
                const st = STATUS_LABEL[a.status] ?? {
                  label: a.status,
                  cls: "bg-neutral-100 text-neutral-500",
                };
                return (
                  <li key={a.id}>
                    <Link
                      href={`/browse/${a.id}`}
                      className="block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-trust-500/40 hover:shadow"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-900">{a.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-neutral-600">
                        {a.short_description}
                      </p>
                      <p className="mt-2 text-[11px] text-neutral-400">
                        {new Date(a.created_at).toLocaleDateString("ko-KR")} 등록
                      </p>
                    </Link>
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
