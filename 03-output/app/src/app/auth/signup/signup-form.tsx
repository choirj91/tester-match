"use client";

import { useState } from "react";
import Link from "next/link";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "가입에 실패했습니다.");
        return;
      }
      setSentTo(email.trim());
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="border-ink-200 bg-surface-1 mt-8 border p-5 text-sm leading-relaxed text-ink-700">
        <p className="font-semibold text-ink-900">가입 링크를 보냈습니다</p>
        <p className="mt-1">
          <strong>{sentTo}</strong> 로 보낸 메일의 [이메일 인증하기] 버튼을 누른 뒤, 열리는
          화면에서 닉네임과 비밀번호를 정하면 가입이 완료됩니다. 메일이 안 보이면 스팸함을
          확인해주세요.
        </p>
        <Link
          href="/auth/login"
          className="text-ink-900 mt-4 inline-block font-semibold hover:underline"
        >
          로그인 화면으로 →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block text-sm font-semibold text-ink-900">
        이메일
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="focus:border-ink-900 focus:ring-accent-600 mt-1.5 w-full border border-ink-900 bg-white px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
        />
        <span className="mt-1 block text-xs font-normal text-ink-600">
          닉네임과 비밀번호는 메일의 링크를 연 다음 화면에서 정합니다.
        </span>
      </label>

      {/* 허니팟 — 화면에 보이지 않고 탭으로도 닿지 않는다 */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="text-danger-700 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-ink-900 hover:bg-black w-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "처리 중..." : "가입 링크 받기"}
      </button>
    </form>
  );
}
