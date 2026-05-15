"use client";

import { useState, useMemo } from "react";

type Candidate = { id: number; nickname: string; trust_score: number; created_at: string };

type Props = {
  appId: number;
  appName: string;
  senderNickname: string;
  shortDescription: string;
  candidates: Candidate[];
  todayCount: number;
  dailyLimit: number;
  remaining: number;
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";

export function RequestForm({
  appId,
  appName,
  senderNickname,
  shortDescription,
  candidates,
  todayCount,
  dailyLimit,
  remaining,
}: Props) {
  // 자동 선택: 최신 순으로 remaining 수만큼 미리 선택
  const defaultSelected = useMemo(
    () => new Set(candidates.slice(0, remaining).map((c) => c.id)),
    [candidates, remaining],
  );

  const [selected, setSelected] = useState<Set<number>>(defaultSelected);
  const [subject, setSubject] = useState(
    `[Tester Match] "${appName}" 테스터 참여 요청`,
  );
  const [message, setMessage] = useState(
    `안녕하세요!\n\n저는 ${senderNickname}입니다. Google Play 출시를 준비 중인 "${appName}" 앱의 테스터를 구하고 있습니다.\n\n${shortDescription}\n\n14일 동안 앱을 설치하고 사용해주시면 큰 도움이 됩니다. 관심이 있으시다면 아래 링크에서 참여 신청해주세요!\n\n함께 해주셔서 감사합니다.\n${senderNickname}`,
  );
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; errors: unknown[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"recipients" | "preview">("recipients");

  const toggleAll = () => {
    if (selected.size === Math.min(candidates.length, remaining)) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.slice(0, remaining).map((c) => c.id)));
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      if (next.size >= remaining) return; // 한도 초과 방지
      next.add(id);
    }
    setSelected(next);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/apps/${appId}/tester-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_ids: Array.from(selected),
          subject,
          message,
        }),
      });
      const data = (await res.json()) as { ok: boolean; sent?: number; skipped?: number; errors?: unknown[]; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "발송에 실패했습니다.");
      } else {
        setResult({ sent: data.sent ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] });
        setSelected(new Set()); // 발송 완료 후 선택 초기화
      }
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  // 발송 완료 화면
  if (result) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <p className="text-4xl font-bold text-trust-600">{result.sent}</p>
        <p className="mt-1 text-base font-semibold text-neutral-900">명에게 발송 완료</p>
        {result.skipped > 0 && (
          <p className="mt-1 text-sm text-neutral-500">
            {result.skipped}명 건너뜀 (이미 요청했거나 이메일 없음)
          </p>
        )}
        <p className="mt-4 text-xs text-neutral-400">
          오늘 총 {todayCount + result.sent}/{dailyLimit}명 발송됨
        </p>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="mt-6 rounded-lg border border-neutral-300 bg-white px-5 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
        >
          추가 발송하기
        </button>
      </div>
    );
  }

  const canSelectMore = selected.size < remaining;
  const allSelected =
    candidates.length > 0 && selected.size === Math.min(candidates.length, remaining);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* 일일 한도 표시 */}
      <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-600">
          오늘 발송 가능:{" "}
          <span className={`font-bold ${remaining === 0 ? "text-crimson-500" : "text-trust-600"}`}>
            {remaining}명
          </span>
          <span className="ml-1 text-neutral-400">/ {dailyLimit}명</span>
        </p>
        <p className="text-sm text-neutral-500">
          선택됨 <span className="font-semibold text-neutral-900">{selected.size}</span>명
        </p>
      </div>

      {remaining === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          오늘 발송 한도를 모두 사용했습니다. 24시간 후 초기화됩니다.
        </p>
      )}

      {/* 탭 */}
      <div className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {(["recipients", "preview"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "recipients" ? `수신자 선택 (${selected.size})` : "이메일 내용 편집"}
          </button>
        ))}
      </div>

      {/* 수신자 선택 탭 */}
      {tab === "recipients" && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                disabled={remaining === 0}
                className="h-4 w-4 rounded border-neutral-300 text-trust-600 focus:ring-trust-500"
              />
              전체 선택 (최대 {remaining}명)
            </label>
            <p className="text-xs text-neutral-400">최근 가입 순 · 이미 요청한 사람 제외</p>
          </div>

          {candidates.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              요청 가능한 후보자가 없습니다.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
              {candidates.map((c) => {
                const isChecked = selected.has(c.id);
                const isDisabled = !isChecked && !canSelectMore;
                return (
                  <li key={c.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition ${
                        isDisabled ? "opacity-40" : "hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(c.id)}
                        disabled={isDisabled}
                        className="h-4 w-4 shrink-0 rounded border-neutral-300 text-trust-600 focus:ring-trust-500"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-neutral-900">
                          {c.nickname}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-neutral-400">★ {c.trust_score}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* 이메일 내용 편집 탭 */}
      {tab === "preview" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-900">
              제목
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className={`${inputClass} mt-2`}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-900">
              본문
              <span className="ml-1 font-normal text-neutral-400">
                (수신자 닉네임 인사는 자동 추가)
              </span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              maxLength={2000}
              className={`${inputClass} mt-2 resize-y font-mono text-xs`}
            />
            <p className="mt-1 text-right text-xs text-neutral-400">
              {message.length} / 2000
            </p>
          </div>
          {/* 미리보기 */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              이메일 미리보기
            </p>
            <p className="text-xs font-semibold text-neutral-500">
              제목: <span className="text-neutral-900">{subject}</span>
            </p>
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
              <strong>(수신자 닉네임)</strong> 님,{"\n\n"}
              {message}
              {"\n\n"}
              <span className="inline-block rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white">
                테스트 참여하기 →
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-500/10 px-3 py-2 text-sm text-crimson-500">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-neutral-400">
          {selected.size}명 선택됨 · 발송 후 동일 앱에 재발송 불가
        </p>
        <button
          type="submit"
          disabled={submitting || selected.size === 0 || remaining === 0}
          className="rounded-lg bg-trust-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
        >
          {submitting ? "발송 중..." : `${selected.size}명에게 발송`}
        </button>
      </div>
    </form>
  );
}
