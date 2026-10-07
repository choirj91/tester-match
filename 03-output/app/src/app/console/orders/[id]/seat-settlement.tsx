"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DISPUTE_CATEGORIES,
  DISPUTE_REASON_MIN,
  SEAT_REWARD_STATUS_LABEL,
  type DisputeCategory,
  type SeatRewardStatus,
} from "@/lib/seat-reward-rules";

const MAX_CONFIRM_ROUNDS = 30;

export type SettlementRow = {
  id: number;
  nickname: string;
  amount: number;
  checkinDays: number;
  status: SeatRewardStatus;
  releaseDueAt: string;
  disputeReason: string | null;
};

type Props = {
  orderId: number;
  rows: SettlementRow[];
};

const TONE: Record<SeatRewardStatus, string> = {
  held: "bg-warning-50 text-warning-700",
  released: "bg-success-50 text-success-700",
  disputed: "bg-danger-50 text-danger-700",
  forfeited: "bg-surface-1 text-ink-600",
};

function dueLabel(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 구매자 정산 패널 — 완주한 시트의 보상을 확정하거나 이의를 제기한다 (ADR-0012 부록 A). */
export function SeatSettlement({ orderId, rows }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<number | null>(null);
  const [category, setCategory] = useState<DisputeCategory>("not_my_app");
  const [reason, setReason] = useState("");
  const heldCount = rows.filter((r) => r.status === "held").length;

  async function call(url: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) setError(data.message ?? "처리에 실패했습니다.");
      else router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function confirmOne(id: number) {
    void call(`/api/seat-rewards/${id}`, { action: "confirm" });
  }

  function submitDispute(id: number) {
    void call(`/api/seat-rewards/${id}`, { action: "dispute", category, reason }).then(() => {
      setDisputing(null);
      setReason("");
    });
  }

  async function confirmAll() {
    if (!window.confirm(`확정 대기 ${heldCount}건을 모두 확정할까요? 테스터에게 크레딧이 즉시 지급되며 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      // 서버가 몇 건씩 처리한다 — 남은 건이 없거나 진전이 없을 때까지 반복
      for (let round = 0; round < MAX_CONFIRM_ROUNDS; round++) {
        const res = await fetch(`/api/seat-rewards/order/${orderId}`, { method: "POST" });
        const data = (await res.json()) as {
          ok: boolean;
          released?: number;
          remaining?: number;
          message?: string;
        };
        if (!data.ok) {
          setError(data.message ?? "처리에 실패했습니다.");
          break;
        }
        if (!data.remaining) break;
        if (!data.released) {
          setError(`${data.remaining}건을 확정하지 못했습니다. 잠시 후 다시 시도해주세요.`);
          break;
        }
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">테스터 보상 확정</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            완주한 테스터의 보상은 확정 전까지 보류됩니다. 문제가 없으면 [확정], 스크린샷 증빙에
            문제가 있으면 [이의 제기]. <strong>3일간 응답이 없으면 자동 확정</strong>됩니다.
          </p>
        </div>
        {heldCount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={confirmAll}
            className="bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            전체 확정 ({heldCount})
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm font-medium text-danger-700">{error}</p>}

      <ul className="mt-4 divide-y divide-ink-200">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={` px-2.5 py-0.5 text-xs font-semibold ${TONE[r.status]}`}>
                  {SEAT_REWARD_STATUS_LABEL[r.status]}
                </span>
                <span className="text-sm font-semibold">{r.nickname}</span>
                <span className="text-xs text-ink-600">
                  {r.checkinDays}일 출석 · {r.amount.toLocaleString("ko-KR")} 크레딧
                </span>
              </div>
              {r.status === "held" && (
                <p className="mt-1 text-xs text-ink-600">자동 확정 예정 {dueLabel(r.releaseDueAt)}</p>
              )}
              {r.status === "disputed" && r.disputeReason && (
                <p className="mt-1 text-xs text-danger-700">이의 사유: {r.disputeReason}</p>
              )}
            </div>
            {r.status === "held" && (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => confirmOne(r.id)}
                  className="bg-success-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-success-700 disabled:opacity-50"
                >
                  확정
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDisputing(disputing === r.id ? null : r.id)}
                  className="border border-ink-900 px-3.5 py-2 text-xs font-semibold text-ink-700 hover:border-danger-700 hover:text-danger-700 disabled:opacity-50"
                >
                  이의 제기
                </button>
              </div>
            )}
            {r.status === "held" && disputing === r.id && (
              <div className="w-full border border-danger-700 bg-danger-50 p-3">
                <p className="text-xs leading-relaxed text-danger-700">
                  이의는 <strong>스크린샷 증빙으로 확인되는 사유</strong>만 인정됩니다. &quot;사용이 부족하다&quot;,
                  &quot;심사에서 떨어졌다&quot;는 사유가 되지 않습니다. 인용되면 이 시트 대금이 환불되고,
                  기각되면 테스터에게 지급됩니다.
                </p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as DisputeCategory)}
                  className="mt-2 w-full border border-ink-900 px-3 py-2 text-xs"
                >
                  {(Object.keys(DISPUTE_CATEGORIES) as DisputeCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {DISPUTE_CATEGORIES[k]}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={`어느 일차의 무엇이 문제인지 ${DISPUTE_REASON_MIN}자 이상 (예: 5~9일차 스크린샷이 다른 앱 화면)`}
                  className="mt-2 w-full border border-ink-900 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  disabled={busy || reason.trim().length < DISPUTE_REASON_MIN}
                  onClick={() => submitDispute(r.id)}
                  className="mt-2 bg-danger-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-danger-700 disabled:opacity-50"
                >
                  이의 제출
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
