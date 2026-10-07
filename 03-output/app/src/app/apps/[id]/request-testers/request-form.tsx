"use client";

import { Check, CircleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/form";

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
    <div className="flex flex-col gap-6">
      <div className="border border-ink-900 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900 bg-surface-1 px-4 py-3">
          <p className="text-sm font-bold text-ink-900">
            수신자 선택 (<span className="tabular">{selected.size} / {MAX_RECIPIENTS}</span>명)
          </p>
          <p className="text-[13px] text-ink-600">최근 가입 순 · 이미 매칭된 테스터 제외</p>
        </div>
        {candidates.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-700">요청 가능한 후보자가 없습니다.</p>
        ) : (
          <ul className="m-0 max-h-96 list-none divide-y divide-ink-200 overflow-y-auto p-0">
            {candidates.map((c) => (
              <li key={c.id} className="px-4 hover:bg-surface-1">
                <Checkbox
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-full"
                  label={
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="min-w-0 truncate font-medium">{c.nickname}</span>
                      <span className="shrink-0 text-[13px] text-ink-600">
                        신뢰도 <span className="tabular">{c.trust_score}</span>
                      </span>
                    </span>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field
        label="요청 메시지"
        hint={
          <span className="block text-right tabular">
            {message.length} / {MESSAGE_MAX}
          </span>
        }
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            maxLength={MESSAGE_MAX}
            className="resize-y"
          />
        )}
      </Field>

      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`flex items-center gap-1.5 text-sm font-medium ${result.ok ? "text-success-700" : "text-danger-700"}`}
        >
          {result.ok ? (
            <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : (
            <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          )}
          {result.text}
        </p>
      )}

      <Button
        onClick={send}
        loading={busy}
        disabled={selected.size === 0 || message.trim().length < 10}
        className="w-full"
      >
        {busy ? "보내는 중…" : `${selected.size}명에게 요청 보내기`}
      </Button>
      <p className="text-[13px] leading-relaxed text-ink-600">
        요청은 수신자의 사이트 알림으로 전달됩니다 (앱당 하루 1회, 최대 {MAX_RECIPIENTS}명). 회원의 이메일
        주소는 제공되지 않습니다. 리뷰·별점 요청은 금지입니다.
      </p>
    </div>
  );
}
