"use client";

import { useMemo, useState } from "react";

type Candidate = { id: number; nickname: string; trust_score: number };

type Props = {
  appId: number;
  appName: string;
  senderNickname: string;
  shortDescription: string;
  candidates: Candidate[];
};

const MAX_RECIPIENTS = 50;
const MESSAGE_MAX = 1000;

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";

/**
 * 테스터 요청 — 선택한 회원에게 사이트 알림으로 전달한다.
 * 회원 이메일은 앱 등록자에게 제공하지 않는다 (개인정보 제3자 제공 금지).
 */
export function RequestForm({ appId, appName, senderNickname, shortDescription, candidates }: Props) {
  const defaultSelected = useMemo(
    () => new Set(candidates.slice(0, MAX_RECIPIENTS).map((c) => c.id)),
    [candidates],
  );
  const [selected, setSelected] = useState<Set<number>>(defaultSelected);
  const [message, setMessage] = useState(
    `안녕하세요, ${senderNickname}입니다. Google Play 출시를 준비 중인 "${appName}" 테스터를 구하고 있습니다.\n${shortDescription}\n14일 동안 설치하고 사용해주시면 큰 도움이 됩니다. 감사합니다 :)`.slice(
      0,
      MESSAGE_MAX,
    ),
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else if (next.size < MAX_RECIPIENTS) next.add(id);
    setSelected(next);
  };

  async function send() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/apps/${appId}/tester-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [...selected], message }),
      });
      const data = (await res.json()) as { ok: boolean; sent?: number; message?: string };
      setResult(
        data.ok
          ? { ok: true, text: `${data.sent ?? 0}명에게 요청 알림을 보냈습니다.` }
          : { ok: false, text: data.message ?? "전송에 실패했습니다." },
      );
    } catch {
      setResult({ ok: false, text: "네트워크 오류가 발생했습니다." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-700">
            수신자 선택 ({selected.size} / {MAX_RECIPIENTS}명)
          </p>
          <p className="text-xs text-neutral-400">최근 가입 순 · 이미 매칭된 테스터 제외</p>
        </div>
        {candidates.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-neutral-500">요청 가능한 후보자가 없습니다.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-neutral-100 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="h-4 w-4 shrink-0 rounded border-neutral-300 text-trust-600"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900">
                    {c.nickname}
                  </span>
                  <span className="shrink-0 text-xs text-neutral-400">★ {c.trust_score}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="text-sm font-semibold text-neutral-900">요청 메시지</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={MESSAGE_MAX}
          className={`${inputClass} mt-2 resize-y`}
        />
        <p className="mt-1 text-right text-xs text-neutral-400">
          {message.length} / {MESSAGE_MAX}
        </p>
      </div>

      {result && (
        <p className={`text-sm font-medium ${result.ok ? "text-mint-500" : "text-red-600"}`}>
          {result.text}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={busy || selected.size === 0 || message.trim().length < 10}
        className="w-full rounded-lg bg-trust-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {busy ? "보내는 중…" : `${selected.size}명에게 요청 보내기`}
      </button>
      <p className="text-xs leading-relaxed text-neutral-500">
        요청은 수신자의 사이트 알림으로 전달됩니다 (앱당 하루 1회, 최대 {MAX_RECIPIENTS}명). 회원의 이메일
        주소는 제공되지 않습니다. 리뷰·별점 요청은 금지입니다.
      </p>
    </div>
  );
}
