import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

// ── 문제 카드 ────────────────────────────────────────────────────────
const PAINS = [
  {
    emoji: "🙏",
    title: "지인 부탁은 피드백이 아닙니다",
    desc: "호의로 설치한 앱은 진짜로 쓰이지 않습니다. 어, 잘 되던데 — 한 마디로 끝나는 테스트는 출시에 도움이 되지 않습니다.",
  },
  {
    emoji: "💬",
    title: "채팅방 12개, 14일을 버티지 못합니다",
    desc: "처음엔 열정적이다가 3일 후엔 읽씹. 12명이 모였다고 해서 12명이 남아있지 않습니다. 한 명 빠지면 다시 처음부터.",
  },
  {
    emoji: "📊",
    title: "숫자만 채우면 피드백이 비어있습니다",
    desc: "Google Play 요건을 통과해도, 진짜 피드백 없이 출시한 앱은 혼자입니다. 테스터의 수가 아니라 테스터의 진심이 필요합니다.",
  },
];

// ── 테스터 혜택 ──────────────────────────────────────────────────────
const TESTER_CARDS = [
  {
    title: "가장 먼저 봅니다",
    desc: "Google Play에 올라오기 전, 아직 세상에 공개되지 않은 앱을 당신이 먼저 씁니다. 출시 직전의 앱은 어디서도 볼 수 없습니다.",
  },
  {
    title: "테스트하고 돈도 법니다",
    desc: "곧 오픈되는 급구 서비스에서는 테스트 완주 시 100원이 지급됩니다. 새로운 것을 구경하면서 크레딧도 쌓이는 구조.",
  },
  {
    title: "개발자에게 직접 닿습니다",
    desc: "당신의 피드백이 출시 전 앱을 바꿉니다. 리뷰 한 줄보다 14일의 실제 사용이 개발자에게는 훨씬 더 큰 도움입니다.",
  },
];

// ── How it works ─────────────────────────────────────────────────────
const STEPS = [
  {
    n: "01",
    who: "개발자",
    title: "앱 등록",
    desc: "초대 링크와 한 줄 소개. 30초면 진짜 테스터들이 볼 수 있는 매칭 목록에 올라갑니다.",
  },
  {
    n: "02",
    who: "테스터",
    title: "앱 선택",
    desc: "관심 가는 앱을 골라 참여 신청. 14일 동안 실제로 씁니다. 어려운 조건 없이, 쓰기만 하면 됩니다.",
  },
  {
    n: "03",
    who: "함께",
    title: "출시 준비 완료",
    desc: "14일이 지나면 개발자는 Google Play 출시 요건을 채우고, 테스터는 다음 앱을 기다립니다.",
  },
];

// ── FAQ ──────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: "테스터로 참여하면 어떤 혜택이 있나요?",
    a: "출시 전 앱을 누구보다 먼저 체험할 수 있습니다. 곧 오픈되는 급구 서비스에서는 테스트 완주 시 100원의 크레딧이 지급됩니다. 크레딧은 내 앱 매칭에도 쓸 수 있습니다.",
  },
  {
    q: "Google Play 정책 위반 아닌가요?",
    a: "비공개 테스트 12명 요건은 Google이 명시한 출시 전 절차입니다. 저희는 인센티브 리뷰·별점 작성을 금지하고, 실제 14일 사용만 매칭합니다.",
  },
  {
    q: "내 앱 정보가 노출되나요?",
    a: "매칭 목록에 올라간 동안 다른 사용자에게 앱 이름·소개·초대 링크가 보입니다. 소스코드·내부 빌드는 노출되지 않습니다.",
  },
  {
    q: "개발자가 아니어도 테스터로만 참여할 수 있나요?",
    a: "물론입니다. 앱 등록 없이 테스터로만 참여해도 됩니다. 관심 있는 앱을 골라 14일 동안 써주시면 됩니다.",
  },
  {
    q: "iOS 도 지원하나요?",
    a: "v1 은 Android Closed Testing 만 지원합니다. iOS TestFlight 는 별도 정책 검토 후 v2 에서 지원 예정입니다.",
  },
];

// ── 메인 ─────────────────────────────────────────────────────────────

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen">
      <SiteHeader user={user} />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <span className="inline-flex items-center rounded-full bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-600">
          베타 오픈 준비 중
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-5xl">
          당신의 앱을 처음으로 열어볼
          <br />
          <span className="text-trust-600">진짜 테스터가 필요합니다</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600">
          처음 세상에 나오는 앱의 긴장감과,
          <br className="hidden sm:block" />
          아무도 모르는 앱을 가장 먼저 발견하는 기쁨이 만나는 곳.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {user ? (
            <>
              <Link
                href="/apps/new"
                className="rounded-lg bg-trust-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                + 내 앱 등록하기
              </Link>
              <Link
                href="/browse"
                className="rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                테스트할 앱 보기
              </Link>
            </>
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

      {/* Problem */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold text-neutral-900 sm:text-3xl">
            테스터를 구하기 어려운 진짜 이유
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-base text-neutral-600">
            사람이 없는 게 아닙니다. 14일을 실제로 써줄 사람을 만나기 어려운 겁니다.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PAINS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <span className="text-2xl">{p.emoji}</span>
                <h3 className="mt-3 text-base font-semibold text-neutral-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For testers */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <span className="inline-flex items-center rounded-full bg-spark-50 px-3 py-1 text-xs font-semibold text-spark-600">
            테스터에게
          </span>
          <h2 className="mt-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            세상에 나오기 전 앱,
            <br />
            <span className="text-trust-600">당신이 가장 먼저 씁니다</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-neutral-600">
            개발자도 테스터도 아니어도 괜찮습니다.
            <br />
            새로운 것을 먼저 써보고 싶은 사람이라면 누구에게나 열려 있습니다.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {TESTER_CARDS.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <h3 className="text-base font-semibold text-neutral-900">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For developers */}
      <section className="bg-trust-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <div className="mb-3 text-center">
            <span className="inline-flex items-center rounded-full bg-trust-100 px-3 py-1 text-xs font-semibold text-trust-700">
              개발자에게
            </span>
          </div>
          <h2 className="text-center text-2xl font-bold text-neutral-900 sm:text-3xl">
            진짜 쓰는 테스터 한 명이
            <br />
            <span className="text-trust-600">지인 12명보다 낫습니다</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-base leading-relaxed text-neutral-600">
            Tester Match의 테스터는 형식적으로 설치만 하지 않습니다.
            14일 동안 실제로 앱을 사용하고, 체크인으로 사용 여부를 스스로 확인합니다.
            당신의 앱은 이미 나올 준비가 됐습니다. 남은 건 진짜 테스터입니다.
          </p>
          <div className="mt-10 text-center">
            {user ? (
              <Link
                href="/apps/new"
                className="inline-flex rounded-lg bg-trust-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                내 앱 등록하기 →
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex rounded-lg bg-trust-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
              >
                Google로 시작하기 →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tabular text-trust-600">{step.n}</span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                  {step.who}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-neutral-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-bold text-neutral-900 sm:text-3xl">자주 묻는 질문</h2>
          <dl className="mt-8 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="border-b border-neutral-200 pb-6">
                <dt className="text-base font-semibold text-neutral-900">Q. {item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-neutral-600">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Waitlist */}
      {!user && (
        <section id="waitlist" className="py-20">
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
