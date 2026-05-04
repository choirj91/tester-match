import { WaitlistForm } from "@/components/waitlist-form";

const STEPS = [
  {
    n: "01",
    title: "앱 등록",
    desc: "Google Play 초대 링크와 한 줄 소개를 입력하면 30초 안에 매칭 큐에 진입합니다.",
  },
  {
    n: "02",
    title: "12명 매칭",
    desc: "Trust Score 기반으로 7일 안에 12명을 채우고, 옵트아웃이 생기면 자동 보충합니다.",
  },
  {
    n: "03",
    title: "14일 완주",
    desc: "이메일·Discord 알림과 1탭 체크인으로 14일 유지율을 자동으로 추적합니다.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-neutral-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-trust-600">Tester Match</span>
          <a
            href="#waitlist"
            className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white hover:bg-trust-700"
          >
            사전 등록
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <span className="inline-flex items-center rounded-full bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-600">
          베타 오픈 준비 중
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-6xl">
          Google Play 비공개 테스트 <br className="hidden sm:block" />
          <span className="text-trust-600">12명을 7일 안에</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
          한국 인디 안드로이드 개발자끼리 품앗이로 12명/14일 요건을 해결합니다. 크레딧 1원 = 1
          크레딧, 1매칭 = 1,000원으로 투명하게.
        </p>

        <div id="waitlist" className="mx-auto mt-10 max-w-md">
          <WaitlistForm />
          <p className="mt-3 text-xs text-neutral-500">
            가장 먼저 베타 초대장을 받아보세요. 이메일 외 정보는 수집하지 않습니다.
          </p>
        </div>
      </section>

      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900 sm:text-3xl">
            어떻게 동작하나요
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <span className="text-sm font-bold text-trust-600 tabular">{step.n}</span>
                <h3 className="mt-2 text-lg font-semibold text-neutral-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="text-3xl font-bold text-trust-600 tabular">12명</p>
            <p className="mt-1 text-sm text-neutral-600">Closed Testing 최소 인원</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-trust-600 tabular">14일</p>
            <p className="mt-1 text-sm text-neutral-600">연속 테스트 유지 요건</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-trust-600 tabular">7일</p>
            <p className="mt-1 text-sm text-neutral-600">목표 매칭 완료 기간</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-neutral-500 sm:flex-row">
          <span>© 2026 Tester Match. 사업자 정보 추후 등록.</span>
          <div className="flex gap-6">
            <a href="/policies/terms" className="hover:text-neutral-900">
              이용약관
            </a>
            <a href="/policies/privacy" className="hover:text-neutral-900">
              개인정보처리방침
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
