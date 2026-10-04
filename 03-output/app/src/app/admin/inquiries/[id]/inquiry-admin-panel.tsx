"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  INQUIRY_ANSWER_MAX,
  INQUIRY_MEMO_MAX,
  INQUIRY_STATUSES,
  type InquiryStatus,
} from "@/lib/validators/inquiry";

type Props = {
  id: number;
  status: InquiryStatus;
  answer: string;
  answeredAt: string;
  memo: string;
};

type ManualStatus = Exclude<InquiryStatus, "answered">;
const MANUAL_STATUSES: ManualStatus[] = ["open", "in_progress", "closed"];

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-1 focus:ring-trust-600";

export function InquiryAdminPanel({ id, status, answer, answeredAt, memo }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState(answer);
  const [memoText, setMemoText] = useState(memo);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string; emailSent?: boolean };
      if (!data.ok) {
        setError(data.message ?? "처리에 실패했습니다.");
      } else {
        setNotice(
          data.emailSent === false
            ? `${done} 메일은 발송되지 않았습니다 — 사이트 알림만 전달됐습니다.`
            : done,
        );
        router.refresh();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function submitAnswer() {
    const text = answerText.trim();
    if (!text) {
      setError("답변 내용을 입력해주세요.");
      return;
    }
    const message = answer
      ? "답변을 고쳐 다시 등록할까요? 작성자에게 알림과 메일이 한 번 더 갑니다."
      : "답변을 등록할까요? 작성자에게 사이트 알림과 메일이 갑니다.";
    if (!window.confirm(message)) return;
    void send({ action: "answer", answer: text }, "답변을 등록했습니다.");
  }

  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-bold text-neutral-900">답변</h2>
        {answer && <p className="tabular mt-1 text-xs text-neutral-400">최근 등록 {answeredAt}</p>}
        <textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          rows={8}
          maxLength={INQUIRY_ANSWER_MAX}
          placeholder="작성자에게 보일 답변을 적어주세요."
          className={`${inputClass} mt-3`}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="tabular text-xs text-neutral-400">
            {answerText.length.toLocaleString("ko-KR")} / {INQUIRY_ANSWER_MAX.toLocaleString("ko-KR")}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={submitAnswer}
            className="bg-trust-600 hover:bg-trust-700 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {answer ? "답변 수정 등록" : "답변 등록"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-bold text-neutral-900">상태</h2>
        <p className="mt-1 text-xs text-neutral-500">
          &ldquo;{INQUIRY_STATUSES.answered}&rdquo;는 답변을 등록하면 자동으로 바뀝니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {MANUAL_STATUSES.map((key) => (
            <button
              key={key}
              type="button"
              disabled={busy || status === key}
              onClick={() =>
                void send({ action: "status", status: key }, `상태를 "${INQUIRY_STATUSES[key]}"로 바꿨습니다.`)
              }
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition disabled:opacity-60 ${
                status === key
                  ? "bg-neutral-900 text-white"
                  : "border border-neutral-300 text-neutral-700 hover:border-neutral-500"
              }`}
            >
              {INQUIRY_STATUSES[key]}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <h2 className="text-sm font-bold text-neutral-900">내부 메모</h2>
        <p className="mt-1 text-xs text-neutral-500">작성자에게 보이지 않습니다.</p>
        <textarea
          value={memoText}
          onChange={(e) => setMemoText(e.target.value)}
          rows={3}
          maxLength={INQUIRY_MEMO_MAX}
          className={`${inputClass} mt-3`}
        />
        <div className="mt-3 text-right">
          <button
            type="button"
            disabled={busy}
            onClick={() => void send({ action: "memo", memo: memoText.trim() }, "메모를 저장했습니다.")}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500 disabled:opacity-50"
          >
            메모 저장
          </button>
        </div>
      </section>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      {notice && <p className="text-sm font-medium text-emerald-700">{notice}</p>}
    </div>
  );
}
