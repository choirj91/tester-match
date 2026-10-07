"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setStatus("error");
        setMessage(data.message ?? "잠시 후 다시 시도해주세요.");
        return;
      }
      setStatus("success");
      setMessage("등록 완료! 베타 시작 시 안내드릴게요.");
      setEmail("");
    } catch {
      setStatus("error");
      setMessage("네트워크 오류. 잠시 후 다시 시도해주세요.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={status === "submitting"}
        placeholder="you@example.com"
        className="flex-1 border border-ink-900 bg-white px-4 py-3 text-sm placeholder:text-ink-600 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-600 disabled:opacity-50"
        aria-label="이메일 주소"
      />
      <button
        type="submit"
        disabled={status === "submitting"}
        className="bg-ink-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black active:bg-black disabled:opacity-50"
      >
        {status === "submitting" ? "등록 중..." : "사전 등록"}
      </button>
      {message && (
        <p
          role="status"
          className={`mt-2 text-sm sm:absolute sm:mt-14 ${
            status === "success" ? "text-success-700" : "text-danger-700"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
