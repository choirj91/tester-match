import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

const STEPS = [
  {
    n: "01",
    title: "앱 등록",
    desc: "Google Play Closed Testing 초대 링크와 한 줄 소개를 입력하면 30초 안에 매칭 큐에 진입합니다.",
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

const PAINS = [
  {
    title: "오픈채팅 12개",
    desc: "카톡방을 옮겨다니며 12명 모집 — 공지·매칭·완주 추적이 흩어집니다.",
  },
  {
    title: "한 명 빠지면 처음부터",
    desc: "5일차에 1명 옵트아웃하면 14일 카운트가 리셋. 모집 처음부터 다시.",
  },
  {
    title: "테스터·개발자 일치 안 됨",
    desc: "내 게임 테스트 줄게요 → 답이 없거나, 받은 사람이 안 들어옴.",
  },
];

const FAQ = [
  {
    q: "Google Play 정책 위반 아닌가요?",
    a: "비공개 테스트 12명 요건은 Google이 명시한 출시 전 절차입니다. 우리는 인센티브 리뷰·별점 작성을 금지하고, 실제 14일 사용만 매칭합니다.",
  },
  {
    q: "결제는 언제부터?",
    a: "베타 기간은 무료 크레딧 지급. 정식 출시 시 1매칭 = 1,000원 (테스터 800 / 플랫폼 200) 으로 운영합니다.",
  },
  {
    q: "내 앱 정보가 노출되나요?",
    a: "매칭 큐에 들어간 동안 다른 사용자에게 앱 이름·설명·초대 링크가 보입니다. 내부 빌드·소스코드는 노출되지 않습니다.",
  },
  {
    q: "iOS 도 지원하나요?",
    a: "v1 은 Android Closed Testing 만. iOS TestFlight 는 별도 정책 검토 후 v2.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen">
      <SiteHeader user={user} />

      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <span className="inline-flex items-center rounded-full bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-600">
          베타 오픈 준비 중
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-6xl">
          Google Play 비공개 테스트 <br className="hidden sm:block" />
          <span className="text-trust-600">12명을 7일 안에</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-700">
          한국 인디 안드로이드 개발자끼리 품앗이로 12명/14일 요건을 해결합니다. <br />
          크레딧 1원 = 1 크레딧, 1매칭 = 1,000원으로 투명하게.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {user ? (
            <Link
              href="/apps/new"
              className="rounded-lg bg-trust-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
            >
              + 내 앱 등록하기
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-lg bg-trust-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                Google로 시작하기
              </Link>
              <a
                href="#waitlist"
                className="rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                사전 등록만 하기
              </a>
            </>
          )}
        </div>
      </section>

      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900 sm:text-3xl">
            왜 직접 모집은 안 되나요
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-base text-neutral-600">
            기존 방식은 카카오 오픈채팅·Reddit·인디 커뮤니티 12개 곳을 동시에 운영해야 합니다.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PAINS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-neutral-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
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
      </section>

      <section className="bg-trust-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
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
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">자주 묻는 질문</h2>
        <dl className="mt-8 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-neutral-200 pb-6">
              <dt className="text-base font-semibold text-neutral-900">Q. {item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-neutral-700">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {!user && (
        <section id="waitlist" className="bg-neutral-50 py-20">
          <div className="mx-auto max-w-md px-6 text-center">
            <h2 className="text-2xl font-bold text-neutral-900">베타 초대를 받아보세요</h2>
            <p className="mt-2 text-sm text-neutral-600">
              정식 오픈 시 가장 먼저 알려드립니다. 이메일 외 정보는 수집하지 않습니다.
            </p>
            <div className="mt-6">
              <WaitlistForm />
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-neutral-200 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-neutral-500 sm:flex-row">
          <span>© 2026 Tester Match. 사업자 정보 추후 등록.</span>
          <div className="flex gap-6">
            <Link href="/policies/terms" className="hover:text-neutral-900">
              이용약관
            </Link>
            <Link href="/policies/privacy" className="hover:text-neutral-900">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
