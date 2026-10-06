import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  PAID_ORDER_STATUS_LABEL,
  PAID_TESTERS_PUBLIC_ORDERING,
  PAID_TESTER_MAX_COUNT,
  PAID_TESTER_PRICE_KRW,
  canOrderPaidTesters,
  isReviewOrderer,
  type PaidOrderStatus,
} from "@/lib/paid-testers";
import { formatKrw } from "@/lib/credits";
import { SEAT_REWARD_MAX } from "@/lib/seat-reward-rules";
import { OrderForm } from "./order-form";

const PRICE_LABEL = `${formatKrw(PAID_TESTER_PRICE_KRW)}원`;

export const metadata = {
  alternates: { canonical: "/paid-testers" },
  title: "유료 테스터",
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
    title: "급구 노출 + 전 회원 알림",
    desc: "결제 즉시 매칭 목록 상단 급구에 노출되고 전 회원에게 알림이 갑니다. 회사가 모집·관리하는 커뮤니티 테스터가 시트를 선착순으로 채웁니다 (신뢰도는 닉네임 옆 ★로 표시).",
  },
  {
    title: "14일 매일 체크인 + 스크린샷",
    desc: "시트 테스터는 매일 앱을 실행하고 스크린샷 1장과 함께 체크인합니다. 콘솔에서 테스터별 증빙을 날짜별로 확인.",
  },
  {
    title: "완주 → 보상 확정",
    desc: "14일 중 12일 이상 출석하면 완주. 테스터 보상은 보류되며, 구매자가 콘솔에서 [확정]하거나 3일간 응답이 없으면 자동 확정됩니다. 증빙에 문제가 있으면 [이의 제기].",
  },
];

const GUARANTEES = [
  "봇·에뮬레이터·다중 계정 참여 금지 — 적발 시 테스터 보상 몰수, 해당 시트 환불",
  "리뷰·별점은 절대 유도하지 않습니다 (위반 시 테스터 보상 몰수, Google Play 정책 준수)",
  "매일 스크린샷 증빙 — 결석 3일째 테스터는 자동 교체, 보상은 구매자 확정 후 지급(에스크로)",
  "완주한 시트만 과금 — 결제 7일 내 못 채운 시트, 마감 후 이탈 시트, 이의가 인용된 시트는 환불",
  "크레딧은 판매하지 않습니다 — 결제 금액은 크레딧으로 바뀌지 않고, 테스터 보상은 회사가 지급합니다",
];

const REFUND_SUMMARY = [
  ["테스터 참여 전 · 결제 7일 이내", "100% 환불"],
  ["결제 후 7일까지 채워지지 않은 시트", "해당 시트 100% 자동 환불"],
  ["충원 마감 후 이탈·이의 인용 시트", "해당 시트 100% 환불"],
  ["완주 후 확정된 시트", "환불 불가 (서비스 제공 완료)"],
] as const;

export default async function PaidTestersPage() {
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

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-trust-600 text-xs font-semibold">PAID TESTERS</p>
          {!PAID_TESTERS_PUBLIC_ORDERING && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
              결제 오픈 대기
            </span>
          )}
        </div>
        <h1 className="mt-1 text-3xl font-bold text-neutral-900">
          테스터가 부족할 때, 1명당 {PRICE_LABEL}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          품앗이로 못 채운 인원을 회사가 모집·관리하는 커뮤니티 테스터가 채웁니다. 1명당{" "}
          {PRICE_LABEL}
          (부가세 포함), 14일간 매일 실기기 체크인. 완주한 시트만 과금합니다.
        </p>

        <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-bold text-amber-900">결제 금액은 어디에 쓰이나요</h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            결제 금액은 14일을 완주한 테스터의 보상(시트당 최대 {formatKrw(SEAT_REWARD_MAX)} 크레딧
            → 기프티콘·네이버페이 포인트)으로 돌아갑니다. Tester Match 는 그 사이에 드는 결제
            수수료와 운영비용만 사용합니다. 수익을 늘리기 위한 서비스가 아니라, 테스터가 테스트하고
            보상을 받아 가고 개발자가 Google Play 요건을 채우도록 잇는 서비스입니다.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">진행 방식</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4"
              >
                <span className="bg-trust-600 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-trust-500/30 bg-trust-50 mt-8 rounded-2xl border p-5">
          <h2 className="text-sm font-bold text-neutral-900">약속</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-neutral-700">
            {GUARANTEES.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-neutral-900">환불 기준</h2>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {REFUND_SUMMARY.map(([when, how]) => (
                <tr key={when} className="border-t border-neutral-200">
                  <td className="py-2 pr-3 text-neutral-700">{when}</td>
                  <td className="py-2 font-semibold text-neutral-900">{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-500">
            환불은 결제대행사를 통해 원결제 수단으로 돌려드립니다 (카드 영업일 3~5일). 전체 기준은{" "}
            <Link href="/policies/refund" className="underline underline-offset-2">
              환불 정책
            </Link>
            .
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-900">신청하기</h2>
          {!user ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">
                로그인 후 앱을 고르고 인원을 선택해 신청합니다.
              </p>
              {!PAID_TESTERS_PUBLIC_ORDERING && (
                <p className="mt-1 text-xs text-amber-800">
                  카드 결제는 오픈 준비 중입니다. 오픈 시 게시판 공지로 안내드립니다.
                </p>
              )}
              <Link
                href="/auth/login?next=/paid-testers"
                className="bg-trust-600 hover:bg-trust-700 mt-3 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              >
                로그인
              </Link>
            </div>
          ) : apps.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
              <p className="text-sm text-neutral-600">
                모집중(매칭 중) 상태의 앱이 없습니다. 앱을 등록하거나, 내 앱에서 상태를 모집중으로
                바꾼 뒤 신청해주세요.
              </p>
              <Link
                href="/apps/new"
                className="bg-trust-600 hover:bg-trust-700 mt-3 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
              >
                앱 등록하기
              </Link>
            </div>
          ) : (
            <OrderForm apps={apps} balance={user.balance ?? 0} orderingOpen={orderingOpen} />
          )}
        </section>

        {orders.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-neutral-900">내 주문</h2>
            <ul className="mt-4 space-y-2">
              {orders.map((o) => (
                <li key={o.id}>
                  <Link
                    href={`/console/orders/${o.id}`}
                    className="hover:border-trust-500 flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition"
                  >
                    <div>
                      <p className="font-semibold text-neutral-900">
                        {o.apps?.name ?? "삭제된 앱"} — {o.tester_count}명
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {new Date(o.created_at).toLocaleDateString("ko-KR")} ·{" "}
                        {formatKrw(o.amount_krw)}원 · {o.order_code} · 출석표·스크린샷 보기 →
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
                      {PAID_ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-xs leading-relaxed text-neutral-400">
          유료 테스터는 회사가 모집·관리하는 커뮤니티 실사용자가 참여하며(테스터 보상 시트당 최대{" "}
          {formatKrw(SEAT_REWARD_MAX)} 크레딧), 리뷰·평점 작성이나 인위적 참여는 제공하지 않습니다.
          테스터에게 현금을 지급하지 않으며, 크레딧은 구매·양도·현금 환급이 불가능합니다 (
          <Link href="/rewards" className="underline underline-offset-2">
            테스터 보상 안내
          </Link>
          ). 환불 기준은{" "}
          <Link href="/policies/refund" className="underline underline-offset-2">
            환불 정책
          </Link>
          을, 이용 조건은{" "}
          <Link href="/policies/terms" className="underline underline-offset-2">
            이용약관
          </Link>
          을 따릅니다.
        </p>
      </main>
    </>
  );
}
