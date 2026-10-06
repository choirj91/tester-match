"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PAID_TESTER_MAX_COUNT,
  PAID_TESTER_MIN_COUNT,
  PAID_TESTER_RECOMMENDED_COUNT,
  paidTesterAmountKrw,
} from "@/lib/paid-testers";

type Props = {
  apps: Array<{ id: number; name: string }>;
  /** 처음 골라 둘 앱 — 앱 관리 화면·급구 알림에서 들어온 경우 */
  initialAppId?: number;
  /** 보유 크레딧 — 결제 금액 이상이면 크레딧 결제 선택지 노출 */
  balance: number;
  /** 주문 게이트 — false 면 폼은 보이되 신청 버튼 대신 "오픈 준비 중" 안내 (ADR-0017 오픈 대기) */
  orderingOpen: boolean;
};

type PayWith = "card" | "credits";

/** 구매 전 유의사항 — 전부 체크해야 결제 가능 (서버도 agreed=true 검증, 주문에 동의 시각 기록) */
const NOTICES = [
  "Play Console 비공개 테스트 트랙에 공용 테스터 그룹(tester-match@googlegroups.com)을 등록했고, 앱의 초대 링크가 정상 동작합니다. 미등록 시 테스터가 설치할 수 없습니다.",
  "테스터는 커뮤니티 실사용자입니다. 시트 충원 시점과 Google의 프로덕션 승인은 보장되지 않습니다.",
  "테스터는 14일 중 12일 이상 스크린샷 체크인 시 완주로 인정됩니다. 결석 3일째 테스터는 자동 교체되며, 교체 테스터는 1일차부터 시작합니다 (충원 기간은 결제 후 7일).",
  "완주한 테스터의 보상은 내가 [확정]하거나 3일간 응답하지 않으면 자동 확정됩니다. 이의는 스크린샷으로 확인되는 사유(내 앱 화면 아님·재사용·금지 행위)만 인정되며, 사용량 부족이나 Google 심사 결과는 사유가 아닙니다.",
  "테스터에게 리뷰·별점을 요청하지 않습니다. 완주한 시트만 과금됩니다 — 결제 7일 내 못 채운 시트, 충원 마감 후 이탈한 시트, 이의가 인용된 시트는 환불됩니다.",
];

export function OrderForm({ apps, initialAppId, balance, orderingOpen }: Props) {
  const router = useRouter();
  const [appId, setAppId] = useState<number>(initialAppId ?? apps[0]?.id ?? 0);
  const [count, setCount] = useState<number>(
    Math.min(PAID_TESTER_MAX_COUNT, PAID_TESTER_RECOMMENDED_COUNT),
  );
  const [payWith, setPayWith] = useState<PayWith>("card");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<boolean[]>(() => NOTICES.map(() => false));
  const allAgreed = checked.every(Boolean);

  const amount = paidTesterAmountKrw(count);
  const canUseCredits = balance >= amount;
  const effectivePayWith: PayWith = canUseCredits ? payWith : "card";

  const presets = [
    1,
    3,
    5,
    10,
    12,
    PAID_TESTER_RECOMMENDED_COUNT,
    20,
    PAID_TESTER_MAX_COUNT,
  ].filter((n, i, all) => n <= PAID_TESTER_MAX_COUNT && all.indexOf(n) === i);
  const clampCount = (n: number) =>
    Math.min(PAID_TESTER_MAX_COUNT, Math.max(PAID_TESTER_MIN_COUNT, Math.floor(n) || PAID_TESTER_MIN_COUNT));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/paid-testers/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_id: appId,
          tester_count: count,
          pay_with: effectivePayWith,
          agreed: allAgreed,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order_code?: string;
        paid?: boolean;
        message?: string;
      };
      if (!data.ok || !data.order_code) {
        setError(data.message ?? "주문 생성에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      router.push(
        data.paid
          ? `/paid-testers/success?orderId=${data.order_code}&credits=1`
          : `/paid-testers/checkout?order=${data.order_code}`,
      );
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 space-y-5 rounded-2xl border border-neutral-200 bg-white p-6"
    >
      <div>
        <label htmlFor="pt-app" className="block text-sm font-semibold text-neutral-900">
          대상 앱
        </label>
        <select
          id="pt-app"
          value={appId}
          onChange={(e) => setAppId(Number(e.target.value))}
          className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
        >
          {apps.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="text-sm font-semibold text-neutral-900">테스터 인원 (시트)</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={PAID_TESTER_MIN_COUNT}
            max={PAID_TESTER_MAX_COUNT}
            value={count}
            onChange={(e) => setCount(clampCount(Number(e.target.value)))}
            className="w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold"
            aria-label="테스터 인원"
          />
          <span className="text-sm text-neutral-600">
            명 ({PAID_TESTER_MIN_COUNT}~{PAID_TESTER_MAX_COUNT})
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCount(n)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                count === n
                  ? "border-trust-600 bg-trust-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-trust-500"
              }`}
            >
              {n}명
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-neutral-500">
          Google 요건은 12명입니다. 14일 사이 1~2명은 빠지기 쉬워 {PAID_TESTER_RECOMMENDED_COUNT}
          명을 권합니다. 여유 있게 잡아도 못 채우거나 완주하지 못한 시트는 환불됩니다.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-neutral-900">결제 수단</p>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="pay_with"
            checked={effectivePayWith === "card"}
            onChange={() => setPayWith("card")}
          />
          신용·체크카드 (KG이니시스)
        </label>
        <label
          className={`flex items-center gap-2 text-sm ${canUseCredits ? "cursor-pointer" : "cursor-not-allowed text-neutral-400"}`}
        >
          <input
            type="radio"
            name="pay_with"
            disabled={!canUseCredits}
            checked={effectivePayWith === "credits"}
            onChange={() => setPayWith("credits")}
          />
          보상으로 적립한 크레딧 사용 (잔액 {balance.toLocaleString("ko-KR")})
          {!canUseCredits && " — 잔액 부족"}
        </label>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3">
        <span className="text-sm text-neutral-600">결제 금액</span>
        <span className="text-lg font-bold text-neutral-900">
          {amount.toLocaleString("ko-KR")}
          {effectivePayWith === "credits" ? " 크레딧" : "원"}
        </span>
      </div>

      <fieldset className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4">
        <legend className="px-1 text-sm font-bold text-amber-900">구매 전 유의사항 (모두 확인 필요)</legend>
        {NOTICES.map((text, i) => (
          <label key={i} className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-amber-900">
            <input
              type="checkbox"
              className="mt-0.5 shrink-0"
              checked={checked[i]}
              onChange={(e) =>
                setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
              }
            />
            <span>{text}</span>
          </label>
        ))}
      </fieldset>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {!orderingOpen && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          카드 결제 오픈 준비 중입니다 (결제대행사 심사 진행 중). 오픈하면 게시판 공지로 알려드리고, 이
          화면에서 바로 신청할 수 있습니다.
        </p>
      )}

      <button
        type="submit"
        disabled={!orderingOpen || submitting || !appId || !allAgreed}
        className="w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {!orderingOpen
          ? "결제 오픈 준비 중"
          : submitting
            ? "주문 생성 중…"
            : effectivePayWith === "credits"
              ? "크레딧으로 시트 열기"
              : "결제하기"}
      </button>
    </form>
  );
}
