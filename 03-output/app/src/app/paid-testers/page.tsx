import { Check } from "lucide-react";
import Link from "next/link";
import { FeeBreakdown } from "@/components/fee-breakdown";
import { SiteHeader } from "@/components/site-header";
import { Badge, PaymentPendingBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { MoneyUseBar } from "@/components/ui/money-use-bar";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { EmptyState } from "@/components/ui/state";
import { StatTile, StatTiles } from "@/components/ui/stat-tile";
import { Steps } from "@/components/ui/steps";
import { Table, type Column } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PAID_ORDER_STATUS_LABEL,
  PAID_TESTERS_PUBLIC_ORDERING,
  PAID_TESTER_MAX_COUNT,
  PAID_TESTER_MIN_COUNT,
  PAID_TESTER_PRICE_KRW,
  canOrderPaidTesters,
  isReviewOrderer,
  type PaidOrderStatus,
} from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { PAID_SEAT_BOOST_DAYS, PAID_SEAT_FILL_DAYS } from "@/lib/paid-seats";
import { SEAT_REWARD_MAX, SEAT_TOTAL_DAYS } from "@/lib/seat-reward-rules";
import { OrderForm } from "./order-form";

const PRICE_LABEL = `${formatKrw(PAID_TESTER_PRICE_KRW)}원`;

export const metadata = {
  alternates: { canonical: "/paid-testers" },
  title: "급구 — 유료 테스터 모집",
  description: `Google Play 비공개 테스트 12명이 부족할 때 — 회사가 모집·관리하는 테스터가 1명당 ${PRICE_LABEL}(부가세 포함)에 14일간 실기기로 매일 스크린샷 체크인합니다. 완주한 시트만 과금.`,
};

type OrderRow = {
  id: number;
  order_code: string;
  tester_count: number;
  amount_krw: number;
  status: PaidOrderStatus;
  created_at: string;
  apps: { name: string } | null;
};

const STEPS = [
  {
    title: "인원 선택·결제",
    desc: `부족한 인원만큼 1~${PAID_TESTER_MAX_COUNT}명(시트)을 선택해 결제합니다. 1명 = ${PRICE_LABEL}(부가세 포함), 신용·체크카드. 판매·환불 주체는 낰낰컴퍼니입니다.`,
  },
  {
    title: "급구 표시 + 전 회원 알림",
    desc: `결제 즉시 매칭 목록 맨 위 급구 칸에 표시되고(결제 후 ${PAID_SEAT_BOOST_DAYS}일, 빈 시트가 남아 있으면 연장) 전 회원에게 알림이 갑니다. 회사가 모집·관리하는 커뮤니티 테스터가 시트를 선착순으로 채웁니다 (신뢰도는 닉네임 옆에 표시).`,
  },
  {
    title: "14일 매일 체크인 + 스크린샷",
    desc: "시트 테스터는 매일 앱을 실행하고 스크린샷 1장과 함께 체크인합니다. 콘솔에서 테스터별 증빙을 날짜별로 확인.",
  },
  {
    title: "완주 → 보상 확정",
    desc: "14일 중 12일 이상 출석하면 완주. 테스터 보상은 보류되며, 개발자가 콘솔에서 [확정]하거나 3일간 응답이 없으면 자동 확정됩니다. 증빙에 문제가 있으면 [이의 제기].",
  },
];

const GUARANTEES = [
  "봇·에뮬레이터·다중 계정 참여 금지 — 적발 시 테스터 보상 몰수, 해당 시트 환불",
  "리뷰·별점은 절대 유도하지 않습니다 (위반 시 테스터 보상 몰수, Google Play 정책 준수)",
  "매일 스크린샷 증빙 — 결석 3일째 테스터는 자동 교체, 보상은 개발자 확정 후 지급(에스크로)",
  "완주한 시트만 과금 — 결제 7일 내 못 채운 시트, 마감 후 이탈 시트, 이의가 인용된 시트는 환불",
  "크레딧은 판매하지 않습니다 — 결제 금액은 크레딧으로 바뀌지 않고, 테스터 보상은 회사가 지급합니다",
];

const HIGHLIGHTS = [
  {
    value: `1명 ${PRICE_LABEL}`,
    label: `부가세 포함 · 필요한 만큼 ${PAID_TESTER_MIN_COUNT}~${PAID_TESTER_MAX_COUNT}명`,
  },
  { value: "매일 증빙", label: "14일 동안 실기기 실행 화면 스크린샷 1장씩" },
  { value: "미완주 시트 환불", label: "못 채운 시트·이탈한 시트·이의가 인용된 시트" },
] as const;

const REFUND_SUMMARY = [
  ["테스터 참여 전 · 결제 7일 이내", "100% 환불"],
  ["결제 후 7일까지 채워지지 않은 시트", "해당 시트 100% 자동 환불"],
  ["충원 마감 후 이탈·이의 인용 시트", "해당 시트 100% 환불"],
  ["완주 후 확정된 시트", "환불 불가 (서비스 제공 완료)"],
] as const;

type RefundRow = (typeof REFUND_SUMMARY)[number];

const REFUND_COLUMNS: ReadonlyArray<Column<RefundRow>> = [
  { key: "when", header: "상황", cell: ([when]) => <span className="text-ink-700">{when}</span> },
  { key: "how", header: "환불", cell: ([, how]) => <strong className="font-semibold">{how}</strong> },
];

export default async function PaidTestersPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const { app: requestedApp } = await searchParams;
  const user = await getCurrentUser();
  const orderingOpen = canOrderPaidTesters(user);

  let apps: Array<{ id: number; name: string }> = [];
  let orders: OrderRow[] = [];
  if (user) {
    const supabase = createSupabaseAdminClient();
    const ownedApps = supabase.from("apps").select("id, name").eq("owner_user_id", user.id);
    // 심사·시험용 계정은 모집중이 아닌(매칭 목록에 안 보이는) 앱으로도 주문한다 — 주문 API 와 같은 기준
    const orderableApps = isReviewOrderer(user)
      ? ownedApps.neq("status", "deleted")
      : ownedApps.eq("status", "matching");
    const [appsRes, ordersRes] = await Promise.all([
      orderableApps.order("created_at", { ascending: false }),
      supabase
        .from("paid_tester_orders")
        .select("id, order_code, tester_count, amount_krw, status, created_at, apps(name)")
        .eq("buyer_user_id", user.id)
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    apps = appsRes.data ?? [];
    orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  }
  // 앱 관리 화면·급구 알림에서 들어오면 그 앱을 골라 둔다 (내 주문 가능 앱일 때만)
  const requestedAppId = Number(requestedApp);
  const hasRequestedApp = Number.isSafeInteger(requestedAppId) && requestedAppId > 0;
  const initialAppId = apps.some((a) => a.id === requestedAppId) ? requestedAppId : undefined;
  // 고른 앱이 신청 대상이 아니면 다른 앱이 골라진 채 결제되지 않도록 알린다
  const requestedAppUnavailable = hasRequestedApp && initialAppId === undefined && apps.length > 0;
  const loginNext = hasRequestedApp ? `/paid-testers?app=${requestedAppId}` : "/paid-testers";

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[1200px] px-5 pt-12 pb-16">
        {/* 첫 화면: 소개 → 영수증 → 환불 기준 (모바일 순서). 데스크톱은 소개·진행 방식 | 영수증 2열 */}
        <div className="grid items-start gap-x-14 gap-y-10 min-[921px]:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex flex-col gap-5 min-[921px]:col-start-1 min-[921px]:row-start-1">
            <p className="m-0 font-mono text-xs tracking-[0.04em] text-accent-600">급구 · 유료 테스터</p>
            <h1 className="m-0 font-display text-display font-semibold text-ink-900">
              테스터는 부탁하는 게 아니라,
              <br />
              내 앱에 투자하는 겁니다
            </h1>
            <p className="m-0 max-w-[560px] text-[15px] leading-[1.75] text-ink-700">
              단톡방에 부탁하고 답을 기다리던 14일 대신, 매일 앱을 열고 스크린샷으로 증빙을 남기는
              테스터와 14일을 채우세요. 회사가 모집·관리하는 커뮤니티 테스터가 1명당 {PRICE_LABEL}
              (부가세 포함)에 참여합니다. 급구를 신청하면 매칭 목록 맨 위에 표시되고 전 회원에게 알림이
              갑니다.
            </p>
            {!PAID_TESTERS_PUBLIC_ORDERING && (
              <Notice>
                카드 결제는 오픈 준비 중입니다. 결제 버튼은 이 페이지 아래{" "}
                <a href="#order" className="text-ink-900 underline hover:text-accent-600">
                  급구 신청하기
                </a>
                에 열립니다. 오픈 시 게시판 공지로 안내드립니다.
              </Notice>
            )}
          </div>

          <Receipt
            className="min-[921px]:col-start-2 min-[921px]:row-span-2 min-[921px]:row-start-1"
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
              <ReceiptRow label="테스터 1명" value={PRICE_LABEL} />
              <ReceiptRow
                label="인원"
                value={`${PAID_TESTER_MIN_COUNT}~${PAID_TESTER_MAX_COUNT}명 선택`}
              />
              <ReceiptRow label="진행 기간" value={`${SEAT_TOTAL_DAYS}일`} />
              <ReceiptRow label="충원 기간" value={`결제 후 ${PAID_SEAT_FILL_DAYS}일`} />
              <ReceiptRow label="급구 표시" value={`결제 후 ${PAID_SEAT_BOOST_DAYS}일`} />
            </ReceiptRows>
            <ReceiptDivider />
            <MoneyUseBar />
            <ReceiptDivider />
            <ReceiptRows className="gap-1.5 text-[13px]">
              <ReceiptRow label="못 채운 시트" value="환불" tone="accent" />
              <ReceiptRow label="완주하지 못한 시트" value="환불" tone="accent" />
            </ReceiptRows>
          </Receipt>

          <section
            aria-labelledby="refund-heading"
            className="flex flex-col gap-3 min-[921px]:col-span-2 min-[921px]:row-start-3"
          >
            <h2 id="refund-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
              환불 기준
            </h2>
            <Table
              caption="환불 기준"
              columns={REFUND_COLUMNS}
              rows={REFUND_SUMMARY}
              rowKey={([when]) => when}
            />
            <p className="m-0 text-xs leading-relaxed text-ink-600">
              환불은 결제대행사를 통해 원결제 수단으로 돌려드립니다 (카드 영업일 3~5일). 전체 기준은{" "}
              <Link href="/policies/refund" className="text-ink-900 underline hover:text-accent-600">
                환불 정책
              </Link>
              .
            </p>
          </section>

          <section
            aria-labelledby="steps-heading"
            className="flex flex-col gap-5 border-t border-ink-900 pt-8 min-[921px]:col-start-1 min-[921px]:row-start-2"
          >
            <h2 id="steps-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
              진행 방식
            </h2>
            <Steps items={STEPS} />
          </section>
        </div>

        <section className="mt-14 border-t border-ink-900 pt-8">
          <StatTiles>
            {HIGHLIGHTS.map((h) => (
              <StatTile key={h.value} rule label={h.label} value={<span className="font-mono text-xl">{h.value}</span>} />
            ))}
          </StatTiles>
        </section>

        <div className="mt-10 grid items-start gap-10 min-[921px]:grid-cols-2">
          <div className="flex flex-col gap-3">
            <FeeBreakdown showBar={false} />
            <p className="m-0 text-sm leading-relaxed text-ink-700">
              수익을 늘리려고 만든 서비스가 아닙니다. 개발자는 Google Play 요건을 채우고, 테스터는 하루
              1분의 체크인으로 보상을 받아 가도록 둘 사이를 잇는 데 결제 금액을 씁니다.
            </p>
          </div>
          <section aria-labelledby="promise-heading" className="flex flex-col gap-3">
            <h2 id="promise-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
              약속
            </h2>
            <ul className="m-0 flex list-none flex-col p-0">
              {GUARANTEES.map((g) => (
                <li
                  key={g}
                  className="flex gap-3 border-t border-ink-200 py-3 text-sm leading-relaxed text-ink-700 first:border-ink-900"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-ink-900" strokeWidth={2} aria-hidden="true" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section id="order" aria-labelledby="order-heading" className="mt-14 scroll-mt-20 border-t border-ink-900 pt-8">
          <h2 id="order-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
            급구 신청하기
          </h2>
          {!user ? (
            <div className="mt-5 flex flex-col items-start gap-3 border border-ink-900 p-6">
              <p className="m-0 text-[15px] text-ink-700">로그인 후 앱을 고르고 인원을 선택해 신청합니다.</p>
              {!PAID_TESTERS_PUBLIC_ORDERING && (
                <p className="m-0 text-sm text-ink-700">
                  카드 결제는 오픈 준비 중입니다. 오픈 시 게시판 공지로 안내드립니다.
                </p>
              )}
              <ButtonLink href={`/auth/login?next=${encodeURIComponent(loginNext)}`}>로그인</ButtonLink>
            </div>
          ) : apps.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                title="모집중인 앱이 없습니다"
                description="모집중(매칭 중) 상태의 앱이 없습니다. 앱을 등록하거나, 내 앱에서 상태를 모집중으로 바꾼 뒤 신청해주세요."
                action={<ButtonLink href="/apps/new">앱 등록하기</ButtonLink>}
              />
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              {requestedAppUnavailable && (
                <Notice kind="caution">
                  선택한 앱은 지금 급구를 신청할 수 없습니다(모집중 상태가 아님). 아래에서 신청할
                  앱을 다시 골라주세요.
                </Notice>
              )}
              <OrderForm
                key={initialAppId ?? "none"}
                apps={apps}
                initialAppId={initialAppId}
                balance={user.balance ?? 0}
                orderingOpen={orderingOpen}
              />
            </div>
          )}
        </section>

        {orders.length > 0 && (
          <section aria-labelledby="orders-heading" className="mt-14 border-t border-ink-900 pt-8">
            <h2 id="orders-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
              내 주문
            </h2>
            <ul className="m-0 mt-5 flex list-none flex-col gap-2 p-0">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/console/orders/${o.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 border border-ink-900 px-4 py-3 text-sm text-ink-900 no-underline hover:bg-surface-1"
                  >
                    <div className="min-w-0">
                      <p className="m-0 font-semibold text-ink-900">
                        {o.apps?.name ?? "삭제된 앱"} — <span className="font-mono">{o.tester_count}명</span>
                      </p>
                      <p className="m-0 mt-0.5 font-mono text-xs text-ink-600 tabular-nums">
                        {new Date(o.created_at).toLocaleDateString("ko-KR")} ·{" "}
                        {formatKrw(o.amount_krw)}원 · {o.order_code} · 출석표·스크린샷 보기 →
                      </p>
                    </div>
                    <Badge tone="outline" className="shrink-0">
                      {PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-14 border-t border-ink-200 pt-5 text-xs leading-relaxed text-ink-600">
          유료 테스터는 회사가 모집·관리하는 커뮤니티 실사용자가 참여하며(테스터 보상 시트당 최대{" "}
          {formatKrw(SEAT_REWARD_MAX)} 크레딧), 리뷰·평점 작성이나 인위적 참여는 제공하지 않습니다.
          테스터에게 현금을 지급하지 않으며, 크레딧은 구매·양도·현금 환급이 불가능합니다 (
          <Link href="/rewards" className="text-ink-900 underline hover:text-accent-600">
            테스터 보상 안내
          </Link>
          ). 환불 기준은{" "}
          <Link href="/policies/refund" className="text-ink-900 underline hover:text-accent-600">
            환불 정책
          </Link>
          을, 이용 조건은{" "}
          <Link href="/policies/terms" className="text-ink-900 underline hover:text-accent-600">
            이용약관
          </Link>
          을 따릅니다.
        </p>
      </main>
    </>
  );
}
