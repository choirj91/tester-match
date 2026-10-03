"use client";

import { useState } from "react";
import Link from "next/link";

type Fields = { email: string; password: string; nickname: string; kakao_nickname: string };

export function SignupForm() {
  const [fields, setFields] = useState<Fields>({
    email: "",
    password: "",
    nickname: "",
    kakao_nickname: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  function update(key: keyof Fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, agreed, website }),
      });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "가입에 실패했습니다.");
        return;
      }
      setSentTo(fields.email.trim());
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="mt-8 rounded-xl border border-trust-500/30 bg-trust-50 p-5 text-sm leading-relaxed text-neutral-700">
        <p className="font-semibold text-neutral-900">인증 메일을 보냈습니다</p>
        <p className="mt-1">
          <strong>{sentTo}</strong> 로 보낸 메일의 [이메일 인증하기] 버튼을 누르면 가입이
          완료됩니다. 메일이 안 보이면 스팸함을 확인해주세요.
        </p>
        <Link
          href="/auth/login"
          className="mt-4 inline-block font-semibold text-trust-600 hover:underline"
        >
          로그인 화면으로 →
        </Link>
      </div>
    );
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <label className="block text-sm font-semibold text-neutral-900">
        이메일
        <input
          type="email"
          autoComplete="email"
          required
          value={fields.email}
          onChange={(e) => update("email", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-semibold text-neutral-900">
        비밀번호 <span className="font-normal text-neutral-500">(8자 이상)</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          value={fields.password}
          onChange={(e) => update("password", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-semibold text-neutral-900">
        닉네임 <span className="font-normal text-neutral-500">(사이트에 표시)</span>
        <input
          type="text"
          required
          maxLength={32}
          value={fields.nickname}
          onChange={(e) => update("nickname", e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block text-sm font-semibold text-neutral-900">
        카카오톡 닉네임 <span className="font-normal text-neutral-500">(오픈채팅방에서 쓰는 이름)</span>
        <input
          type="text"
          required
          maxLength={40}
          value={fields.kakao_nickname}
          onChange={(e) => update("kakao_nickname", e.target.value)}
          className={inputClass}
        />
        <span className="mt-1 block text-xs font-normal text-neutral-500">
          커뮤니티 회원 확인과 안내에만 쓰이며 공개되지 않습니다.
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

      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-neutral-600">
        <input
          type="checkbox"
          className="mt-0.5 shrink-0"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>
          <Link href="/policies/terms" className="underline hover:text-neutral-900">
            이용약관
          </Link>
          과{" "}
          <Link href="/policies/privacy" className="underline hover:text-neutral-900">
            개인정보처리방침
          </Link>
          에 동의합니다.
        </span>
      </label>

      {error && <p className="text-sm text-crimson-500">{error}</p>}

      <button
        type="submit"
        disabled={loading || !agreed}
        className="w-full rounded-lg bg-trust-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
      >
        {loading ? "처리 중..." : "가입하고 인증 메일 받기"}
      </button>
    </form>
  );
}
