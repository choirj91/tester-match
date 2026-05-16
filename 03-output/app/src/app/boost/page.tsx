import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { CostCalculator } from "./cost-calculator";

export const runtime = "edge";
export const metadata = { title: "급구 (오픈 예정)" };

const HOW_IT_WORKS = [
  {
    step: "01",
    who: "개발자",
    title: "급구 등록 및 결제",
    desc: "필요한 테스터 수를 설정하고 인원 × 1,000원을 결제합니다. 앱은 즉시 매칭 목록 최상단에 노출됩니다.",
  },
  {
    step: "02",
    who: "테스터",
    title: "급구 앱 우선 배정",
    desc: "테스터에게 급구 앱이 우선 추천됩니다. 14일 동안 실제로 앱을 사용하고 체크인합니다.",
  },
  {
    step: "03",
    who: "테스터",
    title: "출시 완료 시 보상",
    desc: "앱이 Google Play에 정식 출시되면 참여한 테스터 1인당 100원이 지급됩니다. 테스트하면서 돈도 버는 구조.",
  },
];

export default async function BoostPage() {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* Hero */}
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-spark-50 px-3 py-1 text-xs font-bold text-spark-600">
            서비스 오픈 예정
          </span>
          <h1 className="mt-5 text-3xl font-bold text-neutral-900 sm:text-4xl">
            급구 — 빠른 테스터 모집
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-600">
            결제 한 번으로 앱이 매칭 목록 최상단에 노출됩니다.
            <br />
            테스터는 급구 앱을 우선 배정받고, 출시 성공 시 보상을 받습니다.
          </p>
        </div>

        {/* 핵심 수치 */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { value: "1,000원", label: "테스터 1인당 개발자 비용", color: "text-trust-600" },
            { value: "100원", label: "출시 완료 시 테스터 보상", color: "text-spark-600" },
            { value: "최상단", label: "급구 앱 우선 노출 위치", color: "text-neutral-900" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white p-5 text-center shadow-sm">
              <p className={`text-2xl font-bold tabular ${item.color}`}>{item.value}</p>
              <p className="mt-1 text-sm text-neutral-600">{item.label}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <section className="mt-14">
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

        {/* 비용 계산기 */}
        <section className="mt-14">
          <h2 className="text-xl font-bold text-neutral-900">비용 계산해보기</h2>
          <p className="mt-1 text-sm text-neutral-500">
            슬라이더로 필요한 테스터 수를 조절하면 결제 금액과 테스터 보상이 자동 계산됩니다.
          </p>
          <div className="mt-6">
            <CostCalculator />
          </div>
        </section>

        {/* 개발자 혜택 */}
        <section className="mt-14 rounded-2xl border border-trust-100 bg-trust-50 p-8">
          <h2 className="text-xl font-bold text-neutral-900">개발자에게</h2>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-trust-600">•</span>
              매칭 목록 최상단에 고정 노출되어 테스터 모집 속도가 빨라집니다.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-trust-600">•</span>
              급구 배지가 표시되어 테스터의 관심을 더 끌 수 있습니다.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-trust-600">•</span>
              필요한 인원만큼만 결제. 목표 인원 미달 시 비례 환불됩니다.
            </li>
          </ul>
        </section>

        {/* 테스터 혜택 */}
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900">테스터에게</h2>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700">
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-spark-600">•</span>
              급구 앱은 테스터에게 우선 추천됩니다.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-spark-600">•</span>
              앱이 Google Play에 정식 출시되면{" "}
              <strong>참여 테스터 1인당 100원</strong>이 지급됩니다.
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-bold text-spark-600">•</span>
              세상에 나오기 전 앱을 가장 먼저 써보면서 보상까지 받는 구조입니다.
            </li>
          </ul>
        </section>

        {/* Coming soon CTA */}
        <div className="mt-14 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
          <p className="text-base font-semibold text-neutral-700">결제 기능 오픈 준비 중입니다</p>
          <p className="mt-2 text-sm text-neutral-500">
            정식 오픈 시 베타 사용자에게 가장 먼저 안내드립니다.
            <br />
            지금은 일반 매칭으로 무료로 테스터를 모집할 수 있습니다.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={user ? "/apps/new" : "/auth/login"}
              className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
            >
              {user ? "무료로 앱 등록하기" : "Google로 시작하기"}
            </Link>
            <Link
              href="/browse"
              className="rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              테스트할 앱 보기
            </Link>
          </div>
        </div>

      </main>
    </>
  );
}
