"use client";

import { useState } from "react";
import { PLAY_GROUP_EMAIL } from "@/lib/tester-group";

/** Play Console 등록용 그룹 이메일 복사 버튼 */
export function CopyGroupEmailButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(PLAY_GROUP_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 무시
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="mt-2 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
    >
      {copied ? "✓ 복사됨" : "그룹 이메일 복사"}
    </button>
  );
}
