import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AppScrollBanner } from "@/components/app-scroll-banner";
import { SiteHeader } from "@/components/site-header";
import { OnboardingProgress } from "@/components/onboarding-progress";
import { ButtonLink } from "@/components/ui/button";
import { PaymentPendingBadge } from "@/components/ui/badge";
import { MoneyUseBar } from "@/components/ui/money-use-bar";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { Steps } from "@/components/ui/steps";
import { getCurrentUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { PAID_SEAT_FILL_DAYS, REDEMPTION_MIN_CREDITS } from "@/lib/paid-seats";
import {
  PAID_TESTERS_PUBLIC_ORDERING,
  PAID_TESTER_MAX_COUNT,
  PAID_TESTER_MIN_COUNT,
  PAID_TESTER_PRICE_KRW,
  PAID_TESTER_RECOMMENDED_COUNT,
  paidTesterAmountKrw,
} from "@/lib/paid-testers";
import {
  SEAT_MIN_CHECKIN_DAYS,
  SEAT_REWARDS,
  SEAT_REWARD_MAX,
  SEAT_REWARD_MAX_AT_COMPLETION,
  SEAT_TOTAL_DAYS,
} from "@/lib/seat-reward-rules";
import { PLAY_CLOSED_TEST_TESTERS } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const PRICE = `${formatKrw(PAID_TESTER_PRICE_KRW)}원`;

const STEPS = [
  { title: "앱 등록", desc: "비공개 테스트 링크와 간단한 설명을 올립니다." },
  { title: "매칭 · 급구", desc: "품앗이로 모으고, 모자란 인원은 급구로 채웁니다." },
  {
    title: `${SEAT_TOTAL_DAYS}일 체크인`,
    desc: `테스터가 매일 1분, 스크린샷으로 증빙합니다. ${SEAT_MIN_CHECKIN_DAYS}일 이상이면 완주.`,
  },
  { title: "출시 · 맞테스트", desc: "출시하고, 나를 도운 개발자의 앱도 테스트해 줍니다." },
] as const;

const CREDIT_RULE_LINES = [
  "보상으로만 적립됩니다",
  "구매할 수 없습니다",
  "양도할 수 없습니다",
  "현금으로 환급할 수 없습니다",
] as const;

const FAQ = [
  {
    q: "테스터로 참여하면 어떤 혜택이 있나요?",
    a: `출시 전 앱을 누구보다 먼저 체험할 수 있고, 참여할수록 신뢰도가 쌓입니다. 크레딧은 유료 테스터 시트에 참여했을 때만 적립됩니다 (시트당 최대 ${SEAT_REWARD_MAX}, 완주 후 지급). 크레딧은 기프티콘·네이버페이 포인트로 바꾸거나 내 앱의 테스터 시트를 여는 데 쓸 수 있고, 구매하거나 현금으로 바꿀 수는 없습니다.`,
  },
  {
    q: "급구는 무료 아니었나요?",
    a: "급구는 이제 유료 테스터를 신청한 앱에 함께 켜집니다. 결제하면 매칭 목록 맨 위에 표시되고 전 회원에게 알림이 갑니다. 앱 등록과 품앗이 테스트 참여는 지금처럼 무료입니다.",
  },
  {
    q: "급구(유료 테스터) 결제 금액은 어디에 쓰이나요?",
    a: `테스터 1명당 ${PRICE}(부가세 포함)이며, 못 채우거나 완주하지 못한 시트는 환불됩니다. 회사는 이 금액 가운데 최대 ${formatKrw(SEAT_REWARD_MAX)}원을 14일을 완주한 테스터의 보상(기프티콘·네이버페이 포인트) 비용으로 쓰고, 나머지는 부가세·카드 수수료·서버·보상 발송 같은 운영비에 씁니다. 회사는 크레딧을 판매하지 않고, 테스터에게 현금을 지급하지도 않습니다.`,
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
] as const;

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

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 self-start border-b-[1.5px] border-ink-900 text-[15px] font-medium text-ink-900 no-underline hover:border-accent-600 hover:text-accent-600"
    >
      {children}
      <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
    </Link>
  );
}

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

  // 비로그인이면 로그인부터 (로그인 페이지는 돌아갈 경로를 받지 않는다)
  const registerHref = user ? "/apps/new" : "/auth/login";
  const browseHref = user ? "/browse" : "/auth/login";

  return (
    <main>
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

      {/* 히어로 */}
      <section className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-start gap-14 px-5 pt-16 pb-12">
        <div className="flex flex-col gap-6">
          <p className="m-0 font-mono text-[13px] tracking-[0.02em] text-ink-600">
            GOOGLE PLAY 비공개 테스트 · 테스터 {PLAY_CLOSED_TEST_TESTERS}명 × {SEAT_TOTAL_DAYS}일
          </p>
          <h1 className="m-0 font-display text-display font-semibold text-ink-900">
            부탁은 투자로,
            <br />
            하루 1분은 보상으로
          </h1>
          <p className="m-0 max-w-[520px] text-lead text-ink-700">
            개발자끼리 서로의 앱을 테스트하는 품앗이는 무료입니다. 모자란 인원은 회사가 모집·관리하는
            커뮤니티 테스터로 채우고, 가격과 돈의 쓰임은 영수증처럼 전부 공개합니다.
          </p>
          <div className="flex flex-col gap-3 pt-2 min-[481px]:flex-row min-[481px]:flex-wrap">
            <ButtonLink href={registerHref} size="lg">
              내 앱 등록하기
            </ButtonLink>
            <ButtonLink href={browseHref} size="lg" variant="secondary">
              테스트 참여하기
            </ButtonLink>
          </div>
          <StatTiles className="border-t border-ink-900 pt-5">
            <StatTile label="품앗이" value="무료" />
            <StatTile label="급구 · 테스터 1명" value={PRICE} />
            <StatTile label="완주 기준" value={`${SEAT_TOTAL_DAYS}일 중 ${SEAT_MIN_CHECKIN_DAYS}일`} />
          </StatTiles>
        </div>

        <Receipt
          className="max-w-[420px] justify-self-center"
          title="급구 · 유료 테스터"
          badge={!PAID_TESTERS_PUBLIC_ORDERING && <PaymentPendingBadge />}
          meta="판매자 낰낰컴퍼니 · 부가세 포함 가격"
          footer={
            <>
              판매·환불 주체는 낰낰컴퍼니입니다.{" "}
              <Link href="/policies/refund" className="text-ink-900 underline hover:text-accent-600">
                환불 정책
              </Link>{" "}
              ·{" "}
              <Link href="/policies/terms" className="text-ink-900 underline hover:text-accent-600">
                이용약관
              </Link>
            </>
          }
        >
          <ReceiptDivider />
          <ReceiptRows>
            <ReceiptRow label="테스터 1명" value={PRICE} />
            <ReceiptRow
              label={`기본 ${PAID_TESTER_RECOMMENDED_COUNT}명 (${PAID_TESTER_MIN_COUNT}~${PAID_TESTER_MAX_COUNT}명 선택)`}
              value={`${formatKrw(paidTesterAmountKrw(PAID_TESTER_RECOMMENDED_COUNT))}원`}
            />
            <ReceiptRow label="진행 기간" value={`${SEAT_TOTAL_DAYS}일`} />
            <ReceiptRow label="충원 기간" value={`결제 후 ${PAID_SEAT_FILL_DAYS}일`} />
          </ReceiptRows>
          <ReceiptDivider />
          <MoneyUseBar />
          <ReceiptDivider />
          <ReceiptRows className="gap-1.5 text-[13px]">
            <ReceiptRow label="못 채운 시트" value="환불" tone="accent" />
            <ReceiptRow label="완주하지 못한 시트" value="환불" tone="accent" />
          </ReceiptRows>
        </Receipt>
      </section>

      {/* 지금 테스터를 기다리는 앱들 — 예전 홈의 좌우로 흐르는 카드 배너 (마우스를 올리면 멈춤, 동작 줄이기 설정이면 정지) */}
      <section aria-labelledby="waiting-apps-title" className="border-y border-ink-200 bg-surface-1 py-12">
        <div className="mx-auto mb-8 flex max-w-[1200px] flex-col gap-2 px-5 text-center">
          <p className="m-0 font-mono text-[13px] tracking-[0.02em] text-ink-600">지금 테스터를 기다리는 앱들</p>
          <h2
            id="waiting-apps-title"
            className="m-0 font-display text-h2 font-semibold tracking-[-0.01em] text-ink-900"
          >
            세상에 나오기 직전, 이 앱들을 가장 먼저 써볼 수 있습니다
          </h2>
        </div>
        <AppScrollBanner />
        <div className="mt-8 flex justify-center px-5">
          <ButtonLink href={browseHref} variant="secondary">
            전체 앱 보기
            <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </ButtonLink>
        </div>
      </section>

      {/* 두 사용자 */}
      <section className="mx-auto max-w-[1200px] px-5 pb-14">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(440px,100%),1fr))] border-t border-ink-900">
          <article className="flex flex-col gap-3.5 border-b border-ink-900 py-9 min-[921px]:pr-8">
            <span className="font-mono text-xs tracking-[0.04em] text-accent-600">01 · 개발자</span>
            <h2 className="m-0 font-display text-h1 font-semibold text-ink-900">
              테스터는 부탁하는 게 아니라,
              <br />
              내 앱에 투자하는 겁니다
            </h2>
            <p className="m-0 max-w-[460px] text-[15px] leading-[1.75] text-ink-700">
              앱을 등록하면 품앗이로 매칭되고, 모자란 인원은 급구로 채웁니다. {SEAT_TOTAL_DAYS}일 동안
              테스터의 체크인 증빙을 콘솔에서 매일 확인합니다. 못 채운 시트와 완주하지 못한 시트는
              환불됩니다.
            </p>
            <ArrowLink href="/paid-testers">테스터 모으기</ArrowLink>
          </article>
          <article className="flex flex-col gap-3.5 border-b border-ink-900 py-9 min-[921px]:pl-8">
            <span className="font-mono text-xs tracking-[0.04em] text-accent-600">02 · 테스터</span>
            <h2 className="m-0 font-display text-h1 font-semibold text-ink-900">
              하루 1분, 출시 전 앱을 먼저 쓰고
              <br />
              커피 한 잔을 모읍니다
            </h2>
            <p className="m-0 max-w-[460px] text-[15px] leading-[1.75] text-ink-700">
              매일 앱을 열고 스크린샷 한 장으로 체크인합니다. 유료 시트를 완주하면 회사가 크레딧을
              지급하고(최대 {formatKrw(SEAT_REWARD_MAX_AT_COMPLETION)}, 앱 출시 시 +{SEAT_REWARDS.launch}),{" "}
              {formatKrw(REDEMPTION_MIN_CREDITS)}부터 기프티콘·네이버페이 포인트로 교환합니다.
            </p>
            <ArrowLink href={browseHref}>매칭 목록 보기</ArrowLink>
          </article>
        </div>
      </section>

      {/* 진행 방식 */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 pb-14">
        <h2 className="m-0 font-display text-h2 font-semibold tracking-[-0.01em] text-ink-900">
          등록부터 출시까지
        </h2>
        <Steps items={STEPS} />
      </section>

      {/* 자주 묻는 질문 — 레퍼런스에 없는 기존 섹션, 괘선 목록으로 유지 */}
      <section className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 pb-14">
        <h2 className="m-0 font-display text-h2 font-semibold tracking-[-0.01em] text-ink-900">
          자주 묻는 질문
        </h2>
        <dl className="m-0 border-t border-ink-900">
          {FAQ.map((item) => (
            <div key={item.q} className="border-b border-ink-200 py-5">
              <dt className="text-base font-bold text-ink-900">{item.q}</dt>
              <dd className="m-0 mt-2 max-w-[760px] text-[15px] text-ink-700">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 크레딧 규칙 — 페이지의 반전 섹션 하나 */}
      <section className="bg-surface-ink text-white">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(380px,100%),1fr))] items-center gap-7 px-5 py-11">
          <div className="flex flex-col gap-2">
            <h2 className="m-0 font-display text-h2 font-semibold tracking-[-0.01em]">크레딧은 보상입니다</h2>
            <p className="m-0 max-w-[440px] text-[15px] text-ink-300">
              유료 시트를 완주한 테스터에게 회사가 지급합니다. 돈처럼 다루지 않습니다.
            </p>
          </div>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-x-6 gap-y-2.5 p-0 font-mono text-sm">
            {CREDIT_RULE_LINES.map((line) => (
              <li key={line} className="border-b border-ink-700 py-2.5">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
