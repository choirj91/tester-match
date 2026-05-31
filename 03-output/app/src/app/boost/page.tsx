import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";
export const metadata = { title: "급구 — 빠른 테스터 모집" };

const HOW_IT_WORKS = [
  {
    step: "01",
    who: "개발자",
    title: "급구 켜기",
    desc: "내 앱 관리 화면에서 '급구 켜기' 버튼 한 번이면 끝. 결제 없이 무료로 즉시 적용됩니다.",
  },
  {
    step: "02",
    who: "노출",
    title: "최상단 우선 노출",
    desc: "급구 앱은 매칭 목록 최상단에 BOOST 배지와 함께 고정 노출됩니다. 테스터 눈에 가장 먼저 띕니다.",
  },
  {
    step: "03",
    who: "테스터",
    title: "빠른 모집 완료",
    desc: "테스터가 급구 앱을 먼저 발견하고 참여합니다. 14일 테스트를 더 빨리 시작할 수 있습니다.",
  },
];

export default async function BoostPage() {
  const user = await getCurrentUser();

  // 로그인 시 내가 등록한 앱 목록 (급구 토글용)
  let myApps: { id: number; name: string; is_boost: boolean; status: string }[] = [];
  if (user) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("apps")
      .select("id, name, is_boost, status")
      .eq("owner_user_id", user.id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false });
    myApps = data ?? [];
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-mint-500/10 px-3 py-1 text-xs font-bold text-mint-500">
            무료 제공
          </span>
          <h1 className="mt-5 text-3xl font-bold text-neutral-900 sm:text-4xl">
            급구 — 빠른 테스터 모집
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-600">
            버튼 하나로 내 앱을 매칭 목록 최상단에 노출하세요.
            <br />
            지금은 <strong className="text-neutral-900">무료</strong>로 누구나 사용할 수 있습니다.
          </p>
        </div>

        {/* How it works */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-neutral-900">어떻게 동작하나요</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="tabular text-sm font-bold text-trust-600">{s.step}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                    {s.who}
                  </span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-neutral-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 내 앱 급구 적용 */}
        <section className="mt-12">
          <h2 className="text-xl font-bold text-neutral-900">내 앱에 급구 적용</h2>
          <p className="mt-1 text-sm text-neutral-500">
            앱 관리 화면에서 급구를 켜고 끌 수 있습니다.
          </p>

          {!user ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <p className="text-base font-semibold text-neutral-700">로그인이 필요합니다</p>
              <Link
                href="/auth/login?next=/boost"
                className="mt-5 inline-flex rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                Google로 시작하기
              </Link>
            </div>
          ) : myApps.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
              <p className="text-base font-semibold text-neutral-700">등록한 앱이 없습니다</p>
              <p className="mt-2 text-sm text-neutral-500">앱을 먼저 등록하면 급구를 켤 수 있습니다.</p>
              <Link
                href="/apps/new"
                className="mt-5 inline-flex rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                앱 등록하기 →
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {myApps.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/apps/${a.id}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:border-trust-500 hover:shadow-md"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-neutral-900">{a.name}</span>
                      {a.is_boost && (
                        <span className="shrink-0 rounded-full bg-spark-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                          BOOST
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-trust-600">
                      {a.is_boost ? "급구 관리 ›" : "급구 켜기 ›"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 개발자 혜택 */}
        <section className="mt-12 rounded-2xl border border-trust-100 bg-trust-50 p-8">
          <h2 className="text-xl font-bold text-neutral-900">급구의 효과</h2>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-trust-600">•</span>
              매칭 목록 최상단에 고정 노출되어 테스터 모집 속도가 빨라집니다.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-trust-600">•</span>
              BOOST 배지가 표시되어 테스터의 관심을 더 끌 수 있습니다.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-trust-600">•</span>
              언제든 켜고 끌 수 있고, 지금은 완전 무료입니다.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
