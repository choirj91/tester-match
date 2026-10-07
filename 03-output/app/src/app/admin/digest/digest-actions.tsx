"use client";

import { useState } from "react";

export function DigestActions({ message, openChatUrl }: { message: string; openChatUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // clipboard 권한 실패 시 textarea 폴백은 미리보기에서 수동 복사
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={copy}
        className={` px-5 py-2.5 text-sm font-semibold text-white  ${
          copied ? "bg-success-700" : "bg-ink-900 hover:bg-black"
        }`}
      >
        {copied ? "✓ 복사됨 — 이제 오픈채팅에 붙여넣기" : "1. 메시지 복사"}
      </button>
      <a
        href={openChatUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-[#FEE500] px-5 py-2.5 text-sm font-bold text-[#191919] hover:brightness-95"
      >
        2. 오픈 카톡방 열기 ↗
      </a>
    </div>
  );
}
