"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { FormError } from "../auth-card";

const ERROR_MESSAGE: Record<string, string> = {
  "Invalid login credentials": "이메일 또는 비밀번호가 올바르지 않습니다.",
  "Email not confirmed": "이메일 인증이 필요합니다. 받은 메일의 인증 링크를 눌러주세요.",
};

/** 로그인 후 돌아갈 경로 — 외부 URL 로의 오픈 리다이렉트를 막기 위해 내부 경로만 허용 */
function safeNextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return safeInternalPath(next, window.location.origin);
}

export function EmailSignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError(ERROR_MESSAGE[signInError.message] ?? "로그인에 실패했습니다. 다시 시도해주세요.");
        setLoading(false);
        return;
      }
      // 서버 컴포넌트가 새 세션 쿠키를 읽도록 전체 이동
      window.location.assign(safeNextPath());
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해주세요.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="이메일"
        aria-label="이메일"
      />
      <Input
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="비밀번호"
        aria-label="비밀번호"
      />
      {error && <FormError>{error}</FormError>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "로그인 중..." : "이메일로 로그인"}
      </Button>
    </form>
  );
}
