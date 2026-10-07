import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";
import {
  REDEMPTION_MAX_CREDITS,
  REDEMPTION_MIN_CREDITS,
  REDEMPTION_UNIT_CREDITS,
} from "@/lib/paid-seats";
import {
  CREDIT_RULES,
  REWARD_CATALOG,
  REWARD_KINDS,
  REWARD_PROCESSING_BUSINESS_DAYS,
} from "@/lib/rewards";
import {
  SEAT_REWARDS,
  SEAT_REWARD_MAX,
  SEAT_REWARD_MAX_AT_COMPLETION,
  SEAT_REWARD_SUMMARY,
} from "@/lib/seat-reward-rules";

export const metadata = {
  alternates: { canonical: "/rewards" },
  title: "테스터 보상",
  description:
    "유료 테스터 시트를 14일 완주하면 크레딧이 적립됩니다. 크레딧은 기프티콘·네이버페이 포인트로 바꿀 수 있고, 구매·양도·현금 환급은 되지 않습니다.",
};

/**
 * 보상 교환 상점 (ADR-0017) — 로그인 없이 볼 수 있는 안내 페이지.
 * 실제 교환 신청은 /credits 에서 한다 (잔액·교환 가능액이 필요하므로).
 */
export default async function RewardsPage() {
  const user = await getCurrentUser();
  const unitLabel = formatKrw(REDEMPTION_UNIT_CREDITS);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-ink-900 text-xs font-semibold">REWARDS</p>
        <h1 className="mt-1 text-3xl leading-tight font-bold text-ink-900">
          하루 1분, 출시 전 앱을 먼저 쓰고
          <br />
          <span className="text-ink-900">커피 한 잔을 모읍니다</span>
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-700">
          💰 급구 시트에 참여하면 매일 앱을 열고 스크린샷 1장으로 체크인합니다. 하루 1분이면
          충분합니다. 14일을 완주하면 앱 하나에 최대 {formatKrw(SEAT_REWARD_MAX_AT_COMPLETION)}{" "}
          크레딧(앱이 출시되면 +{SEAT_REWARDS.launch})이 쌓이고, {formatKrw(REDEMPTION_MIN_CREDITS)}{" "}
          크레딧부터 커피 기프티콘이나 네이버페이 포인트로 바꿀 수 있습니다.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          회사는 개발자가 내는 테스터 1명 이용료 {formatKrw(PAID_TESTER_PRICE_KRW)}원 가운데 가장 큰
          몫을 여러분의 보상에 씁니다. 크레딧은 회사가 지급하는 테스트 보상이라 아래 보상으로만 바꿀
          수 있고, 구매하거나 현금으로 바꿀 수는 없습니다.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink-900">어떻게 적립되나요</h2>
          <div className="mt-4 border border-ink-200 bg-white p-5 text-sm leading-relaxed text-ink-700">
            <p>{SEAT_REWARD_SUMMARY}</p>
            <p className="mt-2 text-ink-600">
              시트 하나에 최대 {formatKrw(SEAT_REWARD_MAX)} 크레딧. 12일 이상 출석해야 지급되고,
              완주 후 앱 등록자가 확정하거나 3일이 지나면 적립됩니다. 품앗이(무료) 참여는 신뢰도 ★로
              보상합니다.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-ink-900">무엇으로 바꿀 수 있나요</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {REWARD_KINDS.map((kind) => {
              const item = REWARD_CATALOG[kind];
              return (
                <div
                  key={kind}
                  className="flex flex-col border border-ink-200 bg-white p-5"
                >
                  <p className="text-xs font-semibold tracking-wider text-warning-700 uppercase">
                    {item.label}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-ink-900">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-700">
                    {item.desc}
                  </p>
                  <ul className="mt-4 space-y-1 text-xs text-ink-600">
                    <li>
                      {unitLabel} 크레딧 = {unitLabel}원권 · {unitLabel} 단위 · 1회 최대{" "}
                      {formatKrw(REDEMPTION_MAX_CREDITS)}
                    </li>
                    <li>{item.howDelivered}</li>
                    <li>신청 후 영업일 {REWARD_PROCESSING_BUSINESS_DAYS}일 내 발송</li>
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-600">
            {formatKrw(REDEMPTION_MIN_CREDITS)} 크레딧부터 신청할 수 있습니다. 신청 즉시 크레딧이
            차감되고, 거절되면 전액 복구됩니다. 한 휴대폰 번호는 한 계정에서만 쓸 수 있습니다.
            보상은 회사가 비용으로 지급하며, 리뷰·평점 작성은 보상 대상이 아니라 금지 행위입니다.
          </p>
        </section>

        <section className="border-ink-200 bg-surface-1 mt-10 border p-5">
          <h2 className="text-sm font-bold text-ink-900">크레딧 규칙</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-700">
            {CREDIT_RULES.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-600">
            자세한 기준은{" "}
            <Link href="/policies/credits" className="underline underline-offset-2">
              크레딧 운영 정책
            </Link>
            을 따릅니다.
          </p>
        </section>

        <section className="mt-10 border border-ink-200 bg-white p-6 text-center">
          {user ? (
            <>
              <p className="text-sm text-ink-700">
                보유 크레딧 <strong>{formatKrw(user.balance)}</strong>
              </p>
              <Link
                href="/credits"
                className="bg-ink-900 hover:bg-black mt-3 inline-block px-5 py-2.5 text-sm font-semibold text-white"
              >
                내 크레딧으로 교환 신청 →
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-700">
                로그인하면 보유 크레딧과 교환 신청 화면이 보입니다.
              </p>
              <Link
                href="/auth/login?next=/credits"
                className="bg-ink-900 hover:bg-black mt-3 inline-block px-5 py-2.5 text-sm font-semibold text-white"
              >
                로그인
              </Link>
            </>
          )}
          <p className="mt-3 text-xs text-ink-600">
            <Link href="/browse" className="underline underline-offset-2">
              💰 시트가 열린 앱 보기
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
