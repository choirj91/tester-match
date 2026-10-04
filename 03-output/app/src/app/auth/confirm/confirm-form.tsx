"use client";

import { useState } from "react";
import Link from "next/link";
import {
  KAKAO_NICKNAME_MAX,
  NICKNAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/lib/validators/signup";

const INPUT_CLASS =
  "mt-1.5 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";
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

  return (
    <form method="post" action="/api/auth/confirm" onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold text-neutral-900">
        닉네임 <span className="font-normal text-neutral-500">(사이트에 표시)</span>
        <input type="text" name="nickname" required maxLength={NICKNAME_MAX} className={INPUT_CLASS} />
      </label>
      <label className="block text-sm font-semibold text-neutral-900">
        카카오톡 닉네임{" "}
        <span className="font-normal text-neutral-500">(오픈채팅방에서 쓰는 이름)</span>
        <input
          type="text"
          name="kakao_nickname"
          required
          maxLength={KAKAO_NICKNAME_MAX}
          className={INPUT_CLASS}
        />
        <span className="mt-1 block text-xs font-normal text-neutral-500">
          커뮤니티 회원 확인과 안내에만 쓰이며 공개되지 않습니다.
        </span>
      </label>
      <label className="block text-sm font-semibold text-neutral-900">
        비밀번호 <span className="font-normal text-neutral-500">({PASSWORD_MIN}자 이상)</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          className={INPUT_CLASS}
        />
      </label>
      <label className="block text-sm font-semibold text-neutral-900">
        비밀번호 확인
        <input
          type="password"
          name="password_confirm"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex cursor-pointer items-start gap-2 text-xs leading-relaxed text-neutral-600">
        <input type="checkbox" name="agreed" required className="mt-0.5 shrink-0" />
        <span>
          {/* 새 탭으로 연다 — 같은 탭 이동은 입력 중인 가입 정보를 날린다 */}
          <Link
            href="/policies/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-900"
          >
            이용약관
          </Link>
          과{" "}
          <Link
            href="/policies/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-900"
          >
            개인정보처리방침
          </Link>
          에 동의합니다.
        </span>
      </label>

      {error && <p className="text-crimson-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-trust-600 hover:bg-trust-700 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {submitting ? "처리 중..." : "가입 완료하기"}
      </button>
    </form>
  );
}
