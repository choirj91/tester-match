"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";
import { FormError } from "../auth-card";

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
      <Notice kind="info" title="가입 링크를 보냈습니다" className="mt-7">
        <p className="m-0">
          <strong className="text-ink-900">{sentTo}</strong> 로 보낸 메일의 [이메일 인증하기] 버튼을 누른 뒤, 열리는
          화면에서 닉네임과 비밀번호를 정하면 가입이 완료됩니다. 메일이 안 보이면 스팸함을
          확인해주세요.
        </p>
        <Link
          href="/auth/login"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink-900 underline underline-offset-2 hover:text-accent-600"
        >
          로그인 화면으로
          <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </Notice>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-7 flex flex-col gap-4">
      <Field label="이메일" hint="닉네임과 비밀번호는 메일의 링크를 연 다음 화면에서 정합니다.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}
      </Field>

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

      {error && <FormError>{error}</FormError>}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "처리 중..." : "가입 링크 받기"}
      </Button>
    </form>
  );
}
