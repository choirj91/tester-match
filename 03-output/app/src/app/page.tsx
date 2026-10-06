import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";
import { SiteHeader } from "@/components/site-header";
import { AppScrollBanner } from "@/components/app-scroll-banner";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { getCurrentUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { REDEMPTION_MIN_CREDITS } from "@/lib/paid-seats";
import {
  PAID_TESTERS_PUBLIC_ORDERING,
  PAID_TESTER_PRICE_KRW,
  PAID_TESTER_RECOMMENDED_COUNT,
  paidTesterAmountKrw,
} from "@/lib/paid-testers";
import {
  SEAT_REWARDS,
  SEAT_REWARD_MAX,
  SEAT_REWARD_MAX_AT_COMPLETION,
} from "@/lib/seat-reward-rules";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// ── 문제 카드 ────────────────────────────────────────────────────────
const PAINS = [
  {
    title: "지인 부탁은 피드백이 아닙니다",
    desc: "호의로 설치한 앱은 진짜로 쓰이지 않습니다. 잘 됐어 — 한 마디로 끝나는 테스트는 출시에 도움이 되지 않습니다.",
  },
  {
    title: "채팅방 모집, 14일을 버티지 못합니다",
    desc: "처음엔 열정적이다가 3일 후엔 읽씹. 여러 명이 모였다고 해서 끝까지 남아있지 않습니다. 한 명 빠지면 다시 처음부터.",
  },
  {
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
    title: "하루 1분, 커피 한 잔을 모읍니다",
    desc: `💰 급구 시트는 하루 1분 체크인(앱 실행 + 스크린샷 1장)으로 참여합니다. 14일을 완주하면 앱 하나에 최대 ${formatKrw(SEAT_REWARD_MAX_AT_COMPLETION)} 크레딧(앱이 출시되면 +${SEAT_REWARDS.launch}), ${formatKrw(REDEMPTION_MIN_CREDITS)} 크레딧부터 커피 기프티콘이나 네이버페이 포인트로 바꿉니다.`,
  },
  {
    title: "개발자에게 직접 닿습니다",
    desc: "당신의 피드백이 출시 전 앱을 바꿉니다. 리뷰 한 줄보다 14일의 실제 사용이 개발자에게는 훨씬 더 큰 도움입니다.",
  },
];

// ── 급구 — 부탁 대신 투자, 시간은 보상으로 ────────────────────────────
const PRICE_LABEL = `${formatKrw(PAID_TESTER_PRICE_KRW)}원`;

const CYCLE = [
  {
    who: "개발자",
    value: `${PAID_TESTER_RECOMMENDED_COUNT}명 ${formatKrw(paidTesterAmountKrw(PAID_TESTER_RECOMMENDED_COUNT))}원`,
    desc: "커피 몇 잔 값으로 14일을 함께할 테스터를 모읍니다. 매일 스크린샷 증빙을 확인하고, 못 채우거나 완주하지 못한 시트는 환불받습니다.",
  },
  {
    who: "테스터",
    value: `하루 1분 → 완주 시 최대 ${formatKrw(SEAT_REWARD_MAX_AT_COMPLETION)} 크레딧`,
    desc: `출시 전 앱을 하루 1분씩 열어 보고 14일을 완주하면 앱 하나에 최대 ${formatKrw(SEAT_REWARD_MAX_AT_COMPLETION)} 크레딧, 앱이 출시되면 ${SEAT_REWARDS.launch} 더. 차곡차곡 모으면 고물가 시대 커피 한 잔이 됩니다 (${formatKrw(REDEMPTION_MIN_CREDITS)} 크레딧부터 기프티콘 교환).`,
  },
  {
    who: "Tester Match",
    value: "가장 큰 몫은 테스터 보상에",
    desc: `회사는 1명 ${PRICE_LABEL} 가운데 최대 ${formatKrw(SEAT_REWARD_MAX)}원을 테스터 보상 비용으로 씁니다. 나머지는 부가세·카드 수수료·서버·보상 발송에 쓰고, 남는 돈은 서비스를 계속 운영하는 데 다시 씁니다.`,
  },
] as const;

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
    a: `출시 전 앱을 누구보다 먼저 체험할 수 있고, 참여할수록 신뢰도 ★가 쌓입니다. 크레딧은 💰 유료 테스터 시트에 참여했을 때만 적립됩니다 (시트당 최대 ${SEAT_REWARD_MAX}, 완주 후 지급). 크레딧은 기프티콘·네이버페이 포인트로 바꾸거나 내 앱의 테스터 시트를 여는 데 쓸 수 있고, 구매하거나 현금으로 바꿀 수는 없습니다.`,
  },
  {
    q: "급구는 무료 아니었나요?",
    a: "급구는 이제 유료 테스터를 신청한 앱에 함께 켜집니다. 결제하면 매칭 목록 맨 위에 표시되고 전 회원에게 알림이 갑니다. 앱 등록과 품앗이 테스트 참여는 지금처럼 무료입니다.",
  },
  {
    q: "급구(유료 테스터) 결제 금액은 어디에 쓰이나요?",
    a: `테스터 1명당 ${PRICE_LABEL}(부가세 포함)이며, 못 채우거나 완주하지 못한 시트는 환불됩니다. 회사는 이 금액 가운데 최대 ${formatKrw(SEAT_REWARD_MAX)}원을 14일을 완주한 테스터의 보상(기프티콘·네이버페이 포인트) 비용으로 쓰고, 나머지는 부가세·카드 수수료·서버·보상 발송 같은 운영비에 씁니다. 회사는 크레딧을 판매하지 않고, 테스터에게 현금을 지급하지도 않습니다.`,
  },
  {
    q: "개발자가 아니어도 테스터로만 참여할 수 있나요?",
    a: "물론입니다. 앱 등록 없이 테스터로만 참여해도 됩니다. 관심 있는 앱을 골라 14일 동안 써주시면 됩니다.",
  },
  {
    q: "Google Play 정책 위반 아닌가요?",
    a: "비공개 테스트 요건은 Google이 명시한 출시 전 절차입니다. 저희는 인센티브 리뷰·별점 작성을 금지하고, 실제 14일 사용만 매칭합니다.",
  },
  {
    q: "내 앱 정보가 노출되나요?",
    a: "매칭 목록에 올라간 동안 다른 사용자에게 앱 이름·소개·초대 링크가 보입니다. 소스코드·내부 빌드는 노출되지 않습니다.",
  },
  {
    q: "iOS 도 지원하나요?",
    a: "v1 은 Android Closed Testing 만 지원합니다. iOS TestFlight 는 별도 정책 검토 후 v2 에서 지원 예정입니다.",
  },
];

// ── 메인 ─────────────────────────────────────────────────────────────

const HOME_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tester Match",
  alternateName: "테스터 매치",
  url: "https://tester-match.knockknock.company",
  inLanguage: "ko-KR",
  description:
    "Google Play Closed Testing 12명/14일 요건을 인디 개발자끼리 품앗이로 해결하는 무료 매칭 플랫폼.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://tester-match.knockknock.company/browse?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tester Match",
  url: "https://tester-match.knockknock.company",
  logo: "https://tester-match.knockknock.company/og-image.svg",
};

export default async function HomePage() {
  const user = await getCurrentUser();

  // 로그인 유저 온보딩 진행률 계산
  let onboarding: { signedUp: boolean; hasApp: boolean; hasMatch: boolean } | null = null;
  if (user) {
    const supabase = createSupabaseAdminClient();
    const [{ count: appCount }, { count: matchCount }] = await Promise.all([
      supabase
        .from("apps")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", user.id)
        .neq("status", "deleted"),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("tester_user_id", user.id),
    ]);
    onboarding = {
      signedUp: true,
      hasApp: (appCount ?? 0) > 0,
      hasMatch: (matchCount ?? 0) > 0,
    };
  }

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(HOME_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
      />
      <SiteHeader user={user} />

      {onboarding && <OnboardingProgress steps={onboarding} />}

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <span className="bg-spark-50 text-spark-600 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
          베타 운영 중
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
                내 앱 등록하기
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

      {/* 앱 스크롤 배너 */}
      <section className="bg-neutral-50 py-12">
        <div className="mb-8 px-6 text-center">
          <p className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
            지금 테스터를 기다리는 앱들
          </p>
          <h2 className="mt-2 text-xl font-bold text-neutral-900 sm:text-2xl">
            세상에 나오기 직전, 이 앱들을 가장 먼저 써볼 수 있습니다
          </h2>
        </div>
        <AppScrollBanner />
        <div className="mt-8 text-center">
          <Link
            href={user ? "/browse" : "/auth/login"}
            className="inline-flex rounded-lg border border-neutral-300 bg-white px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            전체 앱 보기 →
          </Link>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-6 py-20">
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
              <h3 className="text-base font-semibold text-neutral-900">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For testers */}
      <section className="bg-neutral-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
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
              개발자가 아니어도 괜찮습니다.
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
            <span className="text-trust-600">지인 여럿보다 낫습니다</span>
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

      {/* 급구 — 부탁 대신 투자 */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="bg-spark-50 text-spark-600 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold">
              급구 · 유료 테스터
            </span>
            {!PAID_TESTERS_PUBLIC_ORDERING && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                결제 오픈 대기
              </span>
            )}
          </div>
          <h2 className="mt-4 text-2xl font-bold text-neutral-900 sm:text-3xl">
            부탁은 투자로,
            <br />
            <span className="text-trust-600">하루 1분은 보상으로</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-600">
            테스터 구하기가 더는 눈치 보는 부탁이 아니었으면 했습니다. 개발자는 1명당 {PRICE_LABEL}
            으로 14일 동안 매일 앱을 여는 테스터를 모으고, 테스터는 하루 1분 체크인으로 출시 전 앱을
            먼저 써 보고 보상을 받습니다.
          </p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {CYCLE.map((c) => (
            <div
              key={c.who}
              className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
            >
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
                {c.who}
              </span>
              <p className="tabular mt-3 text-lg font-bold text-neutral-900">{c.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{c.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/paid-testers"
            className="bg-trust-600 hover:bg-trust-700 rounded-lg px-6 py-3 text-sm font-semibold text-white shadow-sm"
          >
            급구 신청하기 →
          </Link>
          <Link
            href="/rewards"
            className="rounded-lg border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            테스터 보상 보기 →
          </Link>
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
                <span className="tabular text-sm font-bold text-trust-600">{step.n}</span>
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

    </main>
  );
}
