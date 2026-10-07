"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { initialNickname: string; initialKakaoNickname: string };

export function ProfileForm({ initialNickname, initialKakaoNickname }: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [kakaoNickname, setKakaoNickname] = useState(initialKakaoNickname);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const dirty =
    nickname.trim() !== initialNickname || kakaoNickname.trim() !== initialKakaoNickname;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    setSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, kakao_nickname: kakaoNickname }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok || !data.ok) {
      setMessage({ type: "err", text: data.message ?? "수정 실패" });
      setSubmitting(false);
      return;
    }
    setMessage({ type: "ok", text: "변경되었습니다." });
    setSubmitting(false);
    router.refresh();
  }

  const inputClass =
    "w-full  border border-ink-900 bg-white px-3 py-2.5 text-sm  focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-600";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-xs font-semibold text-ink-700">
        닉네임
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={32}
          required
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <label className="block text-xs font-semibold text-ink-700">
        카카오톡 닉네임 <span className="font-normal text-ink-600">(오픈채팅방 이름 · 비공개)</span>
        <input
          type="text"
          value={kakaoNickname}
          onChange={(e) => setKakaoNickname(e.target.value)}
          maxLength={40}
          placeholder="선택 입력"
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !dirty}
          className="bg-ink-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {submitting ? "저장 중..." : "저장"}
        </button>
        {message && (
          <p
            role="status"
            className={`text-sm ${message.type === "ok" ? "text-success-700" : "text-danger-700"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
