import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { RewardIcon } from "@/components/reward-icon";
import { SiteHeader } from "@/components/site-header";
import { AppCard } from "@/components/ui/app-card";
import { ButtonLink } from "@/components/ui/button";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { getCurrentUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import {
  REDEMPTION_MAX_CREDITS,
  REWARD_ITEMS,
  REWARD_MIN_ITEM_CREDITS,
  REWARD_PROCESSING_BUSINESS_DAYS,
} from "@/lib/rewards";
import {
  SEAT_MIN_CHECKIN_DAYS,
  SEAT_REWARDS,
  SEAT_REWARD_HOLD_DAYS,
  SEAT_REWARD_MAX,
  SEAT_REWARD_MAX_AT_COMPLETION,
  SEAT_STREAK_DAYS,
  SEAT_TOTAL_DAYS,
} from "@/lib/seat-reward-rules";
import { CreditRulesSection } from "./credit-rules-section";

export const metadata = {
  alternates: { canonical: "/rewards" },
  title: "테스터 보상",
  description:
    "유료 테스터 시트를 14일 완주하면 크레딧이 적립됩니다. 크레딧은 기프티콘·네이버페이 포인트로 바꿀 수 있고, 구매·양도·현금 환급은 되지 않습니다.",
};

/** 시트 1개 적립 항목 — 항목 이름은 SEAT_REWARD_SUMMARY 와 같은 말을 쓴다 */
const EARNING_ROWS = [
  { label: "설치 인증", value: `${SEAT_REWARDS.install}` },
  { label: "출석", value: `${SEAT_REWARDS.daily}/일` },
  { label: `${SEAT_STREAK_DAYS}일 연속`, value: `+${SEAT_REWARDS.streak}` },
  { label: `완주(${SEAT_MIN_CHECKIN_DAYS}일↑)`, value: `+${SEAT_REWARDS.completion}` },
  { label: "개근", value: `+${SEAT_REWARDS.perfect}` },
  { label: "앱 출시", value: `+${SEAT_REWARDS.launch}` },
] as const;

const LINK = "text-ink-900 underline underline-offset-2 hover:text-accent-600";

/** 상품의 교환 신청 화면 — 로그인 전이면 로그인 뒤 같은 상품으로 돌아온다 */
function exchangeHref(code: string, loggedIn: boolean): string {
  const target = `/credits?item=${encodeURIComponent(code)}#exchange`;
  return loggedIn ? target : `/auth/login?next=${encodeURIComponent(target)}`;
}

/**
 * 보상 교환 상점 (ADR-0017, ADR-0020) — 로그인 없이 볼 수 있는 안내 페이지.
 * 실제 교환 신청은 /credits 에서 한다 (잔액·교환 가능액이 필요하므로).
 */
export default async function RewardsPage() {
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main>
        {/* 머리 + 적립 영수증 */}
        <section className="mx-auto grid max-w-[1200px] grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] items-start gap-12 px-5 pt-14 pb-12">
          <div className="flex flex-col gap-5">
            <p className="text-ink-600 m-0 font-mono text-[13px] tracking-[0.02em]">REWARDS</p>
            <h1 className="font-display text-h1 text-ink-900 m-0 font-semibold min-[761px]:text-[40px] min-[761px]:leading-[1.22]">
              하루 1분, 출시 전 앱을 먼저 쓰고
              <br />
              커피 한 잔을 모읍니다
            </h1>
            <p className="text-ink-700 m-0 max-w-[560px] text-[15px] leading-[1.75]">
              급구 시트에 참여하면 매일 앱을 열고 스크린샷 1장으로 체크인합니다. 하루 1분이면
              충분합니다. {SEAT_TOTAL_DAYS}일을 완주하면 앱 하나에 최대{" "}
              <span className="font-mono tabular-nums">
                {formatKrw(SEAT_REWARD_MAX_AT_COMPLETION)}
              </span>{" "}
              크레딧(앱이 출시되면 +
              <span className="font-mono tabular-nums">{SEAT_REWARDS.launch}</span>)이 쌓이고,{" "}
              <span className="font-mono tabular-nums">{formatKrw(REWARD_MIN_ITEM_CREDITS)}</span>{" "}
              크레딧부터 커피 기프티콘이나 네이버페이 포인트로 바꿀 수 있습니다.
            </p>
            <p className="text-ink-700 m-0 max-w-[560px] text-[15px] leading-[1.75]">
              회사는 개발자가 내는 테스터 1명 이용료{" "}
              <span className="font-mono tabular-nums">{formatKrw(PAID_TESTER_PRICE_KRW)}</span>원
              가운데 가장 큰 몫을 여러분의 보상에 씁니다. 크레딧은 회사가 지급하는 테스트 보상이라
              아래 보상으로만 바꿀 수 있고, 구매하거나 현금으로 바꿀 수는 없습니다.
            </p>
          </div>

          <section
            aria-labelledby="earning-title"
            className="flex w-full max-w-[440px] flex-col gap-3 justify-self-center"
          >
            <h2 id="earning-title" className="text-ink-900 m-0 text-base font-bold">
              어떻게 적립되나요
            </h2>
            <Receipt
              title="유료 시트 1개"
              footer={
                <>
                  시트 하나에 최대 {formatKrw(SEAT_REWARD_MAX)} 크레딧. {SEAT_MIN_CHECKIN_DAYS}일
                  이상 출석해야 지급되고, 완주 후 앱 등록자가 확정하거나 {SEAT_REWARD_HOLD_DAYS}일이
                  지나면 적립됩니다. 품앗이(무료) 참여는 신뢰도로 보상합니다.
                </>
              }
            >
              <ReceiptDivider />
              <ReceiptRows>
                {EARNING_ROWS.map((row) => (
                  <ReceiptRow key={row.label} label={row.label} value={row.value} />
                ))}
              </ReceiptRows>
              <ReceiptDivider />
              <ReceiptRows>
                <ReceiptRow label="최대" value={`${formatKrw(SEAT_REWARD_MAX)} 크레딧`} strong />
              </ReceiptRows>
            </Receipt>
          </section>
        </section>

        {/* 교환 보상 */}
        <section
          aria-labelledby="catalog-title"
          className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 pb-14"
        >
          <h2
            id="catalog-title"
            className="border-ink-900 font-display text-h2 text-ink-900 m-0 border-t pt-8 font-semibold tracking-[-0.01em]"
          >
            무엇으로 바꿀 수 있나요
          </h2>
          <p className="text-ink-700 m-0 max-w-[760px] text-[15px] leading-[1.75]">
            교환 상품마다 정해 둔 크레딧만큼 바꿉니다. 같은 상품을 여러 개 신청할 수 있고, 1회 최대{" "}
            <span className="font-mono tabular-nums">{formatKrw(REDEMPTION_MAX_CREDITS)}</span> 크레딧.
          </p>
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-4 p-0">
            {REWARD_ITEMS.map((item) => (
              <li key={item.code} className="flex">
                <AppCard
                  className="w-full"
                  name={
                    <span className="flex items-center gap-3">
                      <RewardIcon icon={item.icon} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-ink-600 font-sans text-[13px] font-normal">
                          {item.brand}
                        </span>
                        <span>{item.name}</span>
                      </span>
                    </span>
                  }
                  description={item.deliveryNote}
                  meta={`${formatKrw(item.credits)} 크레딧`}
                  action={
                    <ButtonLink
                      href={exchangeHref(item.code, Boolean(user))}
                      variant="secondary"
                      size="sm"
                    >
                      교환 신청
                    </ButtonLink>
                  }
                />
              </li>
            ))}
          </ul>
          <p className="text-ink-600 m-0 max-w-[760px] text-[13px] leading-relaxed">
            신청 즉시 크레딧이 차감되고, 관리자가 확인한 뒤 영업일 {REWARD_PROCESSING_BUSINESS_DAYS}일 내
            휴대폰으로 보내 드립니다. 거절되면 전액 복구됩니다. 한 휴대폰 번호는 한 계정에서만 쓸 수
            있습니다. 보상은 회사가 비용으로 지급하며, 리뷰·평점 작성은 보상 대상이 아니라 금지
            행위입니다. 상품명·브랜드명은 각 회사의 상표입니다.
          </p>
        </section>

        {/* 내 크레딧 / 로그인 */}
        <section className="mx-auto max-w-[1200px] px-5 pb-14">
          <div className="border-ink-900 flex flex-col items-start gap-4 border-t pt-8">
            {user ? (
              <>
                <p className="text-ink-700 m-0 text-[15px]">
                  보유 크레딧{" "}
                  <strong className="text-ink-900 font-mono tabular-nums">
                    {formatKrw(user.balance)}
                  </strong>
                </p>
                <ButtonLink href="/credits">
                  내 크레딧으로 교환 신청
                  <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </ButtonLink>
              </>
            ) : (
              <>
                <p className="text-ink-700 m-0 text-[15px]">
                  로그인하면 보유 크레딧과 교환 신청 화면이 보입니다.
                </p>
                <ButtonLink href="/auth/login?next=/credits">로그인</ButtonLink>
              </>
            )}
            <Link href="/browse" className={`inline-flex min-h-11 items-center text-sm ${LINK}`}>
              시트가 열린 앱 보기
            </Link>
          </div>
        </section>

        <CreditRulesSection />
      </main>
    </>
  );
}
