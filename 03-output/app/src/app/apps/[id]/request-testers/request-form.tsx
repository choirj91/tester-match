"use client";

import { useState, useMemo } from "react";

type Candidate = { id: number; nickname: string; trust_score: number; email: string };

type Props = {
  appId: number;
  appName: string;
  senderNickname: string;
  shortDescription: string;
  candidates: Candidate[];
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";

function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const text = getText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
    >
      {copied ? "복사됨 ✓" : label}
    </button>
  );
}

export function RequestForm({ appId, appName, senderNickname, shortDescription, candidates }: Props) {
  const defaultSelected = useMemo(
    () => new Set(candidates.map((c) => c.id)),
    [candidates],
  );

  const [selected, setSelected] = useState<Set<number>>(defaultSelected);
  const [subject, setSubject] = useState(`[테스터 요청] "${appName}" 앱 테스트에 참여해주세요`);
  const [message, setMessage] = useState(
    `안녕하세요!\n\n저는 ${senderNickname}입니다. Google Play 출시를 준비 중인 "${appName}" 앱의 테스터를 구하고 있습니다.\n\n${shortDescription}\n\n14일 동안 앱을 설치하고 사용해주시면 큰 도움이 됩니다.\n관심이 있으시다면 아래 링크에서 참여 신청해주세요!\n\nhttps://tester-match.pages.dev/browse/${appId}\n\n감사합니다 :)\n${senderNickname}`,
  );
  const [tab, setTab] = useState<"recipients" | "content">("recipients");

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));
  const selectedEmails = selectedCandidates.map((c) => c.email).filter(Boolean);

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // Gmail compose URL (이메일 + 제목 + 본문 자동 채움)
  const gmailUrl = useMemo(() => {
    const params = new URLSearchParams({
      view: "cm",
      to: selectedEmails.join(","),
      su: subject,
      body: message,
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }, [selectedEmails, subject, message]);

  return (
    <div className="space-y-6">
      {/* 탭 */}
      <div className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        {(["recipients", "content"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "recipients" ? `수신자 선택 (${selected.size}명)` : "이메일 내용 편집"}
          </button>
        ))}
      </div>

      {/* ── 수신자 선택 탭 ── */}
      {tab === "recipients" && (
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={selected.size === candidates.length && candidates.length > 0}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-neutral-300 text-trust-600"
              />
              전체 선택
            </label>
            <p className="text-xs text-neutral-400">최근 가입 순 · 이미 매칭된 테스터 제외</p>
          </div>

          {candidates.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              요청 가능한 후보자가 없습니다.
            </p>
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
      )}

      {/* ── 이메일 내용 편집 탭 ── */}
      {tab === "content" && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-neutral-900">제목</label>
              <CopyButton getText={() => subject} label="복사" />
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className={`${inputClass} mt-2`}
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-neutral-900">본문</label>
              <CopyButton getText={() => message} label="복사" />
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              maxLength={2000}
              className={`${inputClass} mt-2 resize-y font-mono text-xs`}
            />
            <p className="mt-1 text-right text-xs text-neutral-400">{message.length} / 2000</p>
          </div>
        </div>
      )}

      {/* ── 이메일 주소 복사 + Gmail 열기 ── */}
      <div className="rounded-2xl border border-trust-100 bg-trust-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-trust-900">
              {selectedEmails.length}개 이메일 주소 준비됨
            </p>
            <p className="mt-0.5 text-xs text-trust-700">
              복사 후 Gmail 받는 사람 칸에 붙여넣기 하거나, 아래 버튼으로 바로 열 수 있어요.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <CopyButton
              getText={() => selectedEmails.join(", ")}
              label="이메일 주소 복사"
            />
            <a
              href={gmailUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition ${
                selectedEmails.length === 0
                  ? "pointer-events-none bg-neutral-200 text-neutral-400"
                  : "bg-trust-600 text-white hover:bg-trust-700"
              }`}
            >
              <GmailIcon />
              Gmail로 바로 열기
            </a>
          </div>
        </div>

        {selectedEmails.length > 0 && (
          <p className="mt-3 rounded-lg bg-white/70 px-3 py-2 font-mono text-xs text-neutral-500 break-all line-clamp-2">
            {selectedEmails.join(", ")}
          </p>
        )}
      </div>

      {/* ── 가이드 ── */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="text-sm font-semibold text-neutral-900">Gmail로 보내는 방법</p>
        <ol className="mt-3 space-y-2 text-sm text-neutral-600">
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-trust-600">1</span>
            <span>
              위 <strong>이메일 주소 복사</strong> 버튼을 클릭해 주소를 복사합니다.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-trust-600">2</span>
            <span>
              <strong>Gmail로 바로 열기</strong>를 클릭하면 받는 사람·제목·본문이 자동으로 채워집니다.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-trust-600">3</span>
            <span>내용을 확인하고 수정한 뒤 발송하세요. 이메일은 직접 보내는 것이므로 스팸 위험이 없습니다.</span>
          </li>
        </ol>
        <p className="mt-3 text-xs text-neutral-400">
          ※ Gmail URL 길이 제한으로 수신자가 많거나 본문이 길면 일부 내용이 잘릴 수 있습니다.
          그럴 경우 이메일 주소와 본문을 각각 복사해서 붙여넣으세요.
        </p>
      </div>
    </div>
  );
}

function GmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11A2.5 2.5 0 0 1 19.5 20h-15A2.5 2.5 0 0 1 2 17.5v-11Z" fill="white" fillOpacity=".2" stroke="white" strokeWidth="1.5"/>
      <path d="M2 7l10 7 10-7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
