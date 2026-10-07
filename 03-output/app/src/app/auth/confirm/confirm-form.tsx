"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { FormError } from "../auth-card";
import {
  KAKAO_NICKNAME_MAX,
  NICKNAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/validators/signup";

const LINK = "text-ink-900 underline underline-offset-2 hover:text-accent-600";
const MISMATCH_MESSAGE = "두 칸의 비밀번호가 서로 다릅니다. 다시 입력해주세요.";

/**
 * 가입 2단계 양식. 서버(/api/auth/confirm)가 다시 검증한다 — 여기서는 비밀번호 불일치만
 * 미리 잡아, 서버 오류로 돌아와 입력을 처음부터 다시 하는 일을 줄인다.
 */
export function ConfirmForm({ serverError }: { serverError: string | null }) {
  const [error, setError] = useState<string | null>(serverError);
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("password_confirm")) {
      e.preventDefault();
      setError(MISMATCH_MESSAGE);
      return;
    }
    setSubmitting(true);
  }

  const note = (text: string) => <span className="font-normal text-ink-600">({text})</span>;

  return (
    <form method="post" action="/api/auth/confirm" onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field label={<>닉네임 {note("사이트에 표시")}</>}>
        {({ id }) => <Input id={id} type="text" name="nickname" required maxLength={NICKNAME_MAX} />}
      </Field>
      <Field
        label={<>카카오톡 닉네임 {note("오픈채팅방에서 쓰는 이름")}</>}
        hint="커뮤니티 회원 확인과 안내에만 쓰이며 공개되지 않습니다."
      >
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            type="text"
            name="kakao_nickname"
            required
            maxLength={KAKAO_NICKNAME_MAX}
          />
        )}
      </Field>
      <Field label={<>비밀번호 {note(`${PASSWORD_MIN}자 이상`)}</>}>
        {({ id }) => (
          <Input
            id={id}
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
          />
        )}
      </Field>
      <Field label="비밀번호 확인">
        {({ id }) => (
          <Input
            id={id}
            type="password"
            name="password_confirm"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
          />
        )}
      </Field>

      <Checkbox
        name="agreed"
        required
        className="text-sm leading-relaxed text-ink-700"
        label={
          <>
            {/* 새 탭으로 연다 — 같은 탭 이동은 입력 중인 가입 정보를 날린다 */}
            <Link href="/policies/terms" target="_blank" rel="noopener noreferrer" className={LINK}>
              이용약관
            </Link>
            과{" "}
            <Link href="/policies/privacy" target="_blank" rel="noopener noreferrer" className={LINK}>
              개인정보처리방침
            </Link>
            에 동의합니다.
          </>
        }
      />

      {error && <FormError>{error}</FormError>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "처리 중..." : "가입 완료하기"}
      </Button>
    </form>
  );
}
