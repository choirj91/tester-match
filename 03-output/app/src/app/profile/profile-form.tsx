"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileForm({ initialNickname }: { initialNickname: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (nickname.trim() === initialNickname) return;
    setSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
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

  const dirty = nickname.trim() !== initialNickname;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={32}
        required
        className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20"
      />
      <button
        type="submit"
        disabled={submitting || !dirty}
        className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {submitting ? "저장 중..." : "저장"}
      </button>
      {message && (
        <p
          role="status"
          className={`text-sm sm:basis-full ${
            message.type === "ok" ? "text-mint-500" : "text-crimson-500"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
