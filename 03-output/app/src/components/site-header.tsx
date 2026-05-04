import Link from "next/link";
import type { AppUser } from "@/lib/auth";

export function SiteHeader({ user }: { user: AppUser }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-trust-600">
          Tester Match
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/apps" className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
            내 앱
          </Link>
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.nickname}</span>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm text-neutral-500 transition hover:text-crimson-500"
            >
              로그아웃
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
