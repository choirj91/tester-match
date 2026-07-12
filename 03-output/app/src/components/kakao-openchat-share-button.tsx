"use client";

import { useState } from "react";

const OPENCHAT_URL = "https://open.kakao.com/o/ghJ9350f";

export function KakaoOpenchatShareButton({
  text,
  label = "카톡 오픈채팅에 공유",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setFailed(false);
    // 새 탭을 먼저 열어 팝업 차단 회피
    const win = window.open(OPENCHAT_URL, "_blank", "noopener,noreferrer");
    if (!win) {
      setFailed(true);
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // fallback: 텍스트 영역으로 복사
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
        setTimeout(() => setCopied(false), 4000);
      } catch {
        setFailed(true);
      }
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEE500] px-3 py-2 text-sm font-semibold text-[#3C1E1E] shadow-sm transition hover:bg-[#FADA0A]"
      >
        {/* 카톡 아이콘 (간단 chat bubble) */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.87 5.35 4.69 6.75-.2.72-.72 2.56-.82 2.96-.12.5.18.5.38.36.16-.1 2.5-1.7 3.52-2.4.72.1 1.46.16 2.23.16 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8Z" />
        </svg>
        {label}
      </button>
      {copied && (
        <p className="text-[11px] font-semibold text-mint-500">
          ✓ 문구가 복사되었습니다. 채팅방에 붙여넣기 하세요.
        </p>
      )}
      {failed && !copied && (
        <p className="text-[11px] font-semibold text-crimson-500">
          복사 실패. 문구를 직접 복사해주세요.
        </p>
      )}
    </div>
  );
}
