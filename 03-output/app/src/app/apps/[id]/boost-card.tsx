import Link from "next/link";
import { formatKrw } from "@/lib/credits";
import { PAID_TESTER_PRICE_KRW } from "@/lib/paid-testers";

type Props = {
  appId: number;
  isBoost: boolean;
  deadlineAt: string | null;
  /** 이 앱으로 급구를 신청할 수 있는지 — 주문 API 와 같은 기준(모집중 앱, 심사 계정은 삭제 안 된 앱) */
  canOrder: boolean;
};

/**
 * 앱 관리 화면의 급구 카드. 급구는 유료 테스터 결제가 확정될 때 켜지므로
 * 여기서는 상태만 보여 주고 급구 신청(결제) 화면으로 보낸다. 직접 켜고 끄는 버튼은 없다.
 */
export function BoostCard({ appId, isBoost, deadlineAt, canOrder }: Props) {
  const until = deadlineAt
    ? new Date(deadlineAt).toLocaleDateString("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <section
      className={`mt-8 rounded-2xl border p-6 shadow-sm ${
        isBoost ? "border-spark-500/40 bg-spark-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-neutral-900">급구</h2>
            {isBoost && (
              <span className="bg-spark-500 rounded-full px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                BOOST
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
            {isBoost
              ? `매칭 목록 맨 위 급구 칸에 표시 중입니다${until ? ` (${until}까지)` : ""}. 빈 유료 시트가 남아 있으면 자동으로 연장됩니다.`
              : `급구는 유료 테스터를 신청하면 켜집니다. 결제하면 매칭 목록 맨 위에 표시되고 전 회원에게 알림이 갑니다. 1명당 ${formatKrw(PAID_TESTER_PRICE_KRW)}원(부가세 포함), 못 채우거나 완주하지 못한 시트는 환불됩니다.`}
          </p>
          {!canOrder && (
            <p className="mt-1 text-xs text-neutral-500">
              모집중 상태인 앱만 급구를 신청할 수 있습니다.
            </p>
          )}
        </div>
        {canOrder && (
          <Link
            href={`/paid-testers?app=${appId}`}
            className="bg-spark-500 hover:bg-spark-600 shrink-0 rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition"
          >
            {isBoost ? "테스터 더 모집하기" : "급구 신청하기"}
          </Link>
        )}
      </div>
    </section>
  );
}
