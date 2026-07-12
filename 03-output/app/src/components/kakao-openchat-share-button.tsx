"use client";

import { useEffect, useState } from "react";

const OPENCHAT_URL = "https://open.kakao.com/o/ghJ9350f";

export function KakaoOpenchatShareButton({
  text,
  label = "카톡 오픈채팅에 공유",
}: {
  text: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      setCopyFailed(false);
    }
  }, [open]);

  // ESC 로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function copyToClipboard() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      return;
    } catch {
      // fallback
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  function openOpenchat() {
    window.open(OPENCHAT_URL, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  return (
    <>
      {/* 트리거 버튼 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-3 py-2 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#FADA0A]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.87 5.35 4.69 6.75-.2.72-.72 2.56-.82 2.96-.12.5.18.5.38.36.16-.1 2.5-1.7 3.52-2.4.72.1 1.46.16 2.23.16 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8Z" />
        </svg>
        {label}
      </button>

      {/* 모달 */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
              <h3 className="text-base font-bold text-neutral-900">카톡 오픈채팅 공유</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                aria-label="닫기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 본문 */}
            <div className="px-5 py-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-trust-600 text-[10px] font-bold text-white">1</span>
                <p className="text-sm font-semibold text-neutral-800">채팅방에 붙여넣을 문구를 확인하세요</p>
              </div>
              <textarea
                readOnly
                value={text}
                rows={12}
                className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-700 focus:outline-none focus:ring-2 focus:ring-trust-500/30"
              />

              <div className="mt-4 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-trust-600 text-[10px] font-bold text-white">2</span>
                <p className="text-sm font-semibold text-neutral-800">문구를 클립보드에 복사</p>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  {copied ? "다시 복사" : "복사하기"}
                </button>
                {copied && (
                  <span className="text-xs font-semibold text-mint-500">✓ 클립보드에 복사되었습니다</span>
                )}
                {copyFailed && (
                  <span className="text-xs font-semibold text-crimson-500">복사 실패 — 위 문구를 직접 선택해 복사해주세요</span>
                )}
              </div>

              <div className="mt-5 flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                    copied ? "bg-trust-600" : "bg-neutral-300"
                  }`}
                >
                  3
                </span>
                <p
                  className={`text-sm font-semibold ${
                    copied ? "text-neutral-800" : "text-neutral-400"
                  }`}
                >
                  카톡 오픈채팅방 열기 → 붙여넣기 (Ctrl/⌘+V)
                </p>
              </div>
              <button
                type="button"
                onClick={openOpenchat}
                disabled={!copied && !copyFailed}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FEE500] px-4 py-2.5 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#FADA0A] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.87 5.35 4.69 6.75-.2.72-.72 2.56-.82 2.96-.12.5.18.5.38.36.16-.1 2.5-1.7 3.52-2.4.72.1 1.46.16 2.23.16 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8Z" />
                </svg>
                카톡 오픈채팅방 열기
              </button>
              {!copied && !copyFailed && (
                <p className="mt-2 text-center text-[11px] text-neutral-400">
                  먼저 [복사하기] 를 눌러주세요
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
