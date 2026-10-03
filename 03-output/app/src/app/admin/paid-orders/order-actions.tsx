"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaidOrderStatus } from "@/lib/paid-testers";

type Action = "start" | "complete" | "cancel" | "close_seats" | "mark_refunded";

type Props = {
  orderId: number;
  status: PaidOrderStatus;
  seatsClosed: boolean;
  refundDueKrw: number;
  fulfillment: "community" | "operator";
};

export function OrderActions({ orderId, status, seatsClosed, refundDueKrw, fulfillment }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = status === "paid" || status === "in_progress";
  const buttons: Array<{ action: Action; label: string; confirm?: string; tone: string }> = [];
  if (refundDueKrw > 0) {
    buttons.push({
      action: "mark_refunded",
      label: `환불 완료 (${refundDueKrw.toLocaleString("ko-KR")}원)`,
      confirm: `토스 대시보드에서 ${refundDueKrw.toLocaleString("ko-KR")}원 부분취소를 마쳤나요? 환불 완료로 기록합니다.`,
      tone: "bg-red-600 text-white hover:bg-red-700",
    });
  }
  if (isOpen && !seatsClosed) {
    buttons.push({
      action: "close_seats",
      label: "시트 마감",
      confirm: "빈 시트를 닫고 그만큼 환불 처리합니다 (크레딧 자동 환급 / 토스는 환불 대기). 진행 중 테스터는 그대로 진행됩니다.",
      tone: "border border-neutral-300 text-neutral-700 hover:border-amber-500 hover:text-amber-700",
    });
  }
  if (status === "paid" && !seatsClosed) {
    buttons.push({
      action: "start",
      label: "운영자 투입 개시",
      confirm: "커뮤니티 시트 배정을 멈추고 운영자 테스터 계정으로 진행합니다 (폴백). 계속할까요?",
      tone: "border border-trust-500 text-trust-600 hover:bg-trust-50",
    });
  }
  // 운영자 처리 주문(폴백·심사용)만 수동 완료 — 커뮤니티 주문은 완주·시트 마감으로 자동 종결
  if (fulfillment === "operator" && isOpen) {
    buttons.push({
      action: "complete",
      label: "완료",
      confirm: "운영자 처리 주문을 완료로 기록할까요? 환불은 발생하지 않습니다.",
      tone: "bg-emerald-600 text-white hover:bg-emerald-700",
    });
  }
  // 시트가 마감된 커뮤니티 주문은 빈 시트 환불이 이미 돌았다 — 전액 취소는 서버가 거부한다
  const cancelable =
    status === "pending" || (status === "paid" && (fulfillment === "operator" || !seatsClosed));
  if (cancelable) {
    buttons.push({
      action: "cancel",
      label: "취소",
      confirm: "주문을 취소하고 전액 환불할까요? 크레딧 결제는 자동 환급, 토스 결제는 환불 대기로 표시됩니다.",
      tone: "border border-neutral-300 text-neutral-600 hover:border-red-400 hover:text-red-600",
    });
  }
  if (buttons.length === 0) return null;

  async function run(action: Action, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/paid-orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, action }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) setError(data.message ?? "실패했습니다.");
      else router.refresh();
    } catch {
      setError("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <div className="flex flex-wrap justify-end gap-2">
        {buttons.map((b) => (
          <button
            key={b.action}
            type="button"
            disabled={busy}
            onClick={() => run(b.action, b.confirm)}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${b.tone}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-1.5 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
