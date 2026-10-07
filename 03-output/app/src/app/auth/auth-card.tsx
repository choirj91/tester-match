import { ArrowLeft, CircleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** 로그인·가입 화면 공통 틀 — 흰 바탕 위 1px 먹선 상자 하나, 세리프 h1 하나 */
export function AuthCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-0 px-5 py-12">
      <div className="flex w-full max-w-[400px] flex-col border border-ink-900 bg-white px-6 py-8 min-[481px]:px-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-bold tracking-tight text-ink-900 no-underline hover:text-accent-600"
        >
          <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Tester Match
        </Link>
        <h1 className="m-0 mt-4 font-display text-h1 font-semibold text-ink-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}

/** 폼 오류 한 줄 — 색·아이콘·문구 셋으로 알린다 */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="m-0 flex items-start gap-1.5 text-[13px] text-danger-700">
      <CircleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
