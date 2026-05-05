import Link from "next/link";
import type { AppUser } from "@/lib/auth";

type NavItem = { href: string; label: string; soon?: boolean };

const NAV: readonly NavItem[] = [
  { href: "/browse", label: "매칭 가능" },
  { href: "/boost", label: "급구", soon: true },
  { href: "/board", label: "게시판" },
  { href: "/my-tests", label: "내 테스트" },
  { href: "/apps", label: "내 앱" },
];

export function SiteHeader({ user }: { user: AppUser | null }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-trust-600">
          Tester Match
        </Link>

        <nav className="hidden flex-1 items-center gap-6 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
            >
              {item.label}
              {item.soon && (
                <span className="ml-1.5 rounded-full bg-spark-50 px-1.5 py-0.5 text-[10px] font-bold text-spark-600">
                  준비중
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {user ? (
            <>
              <span className="hidden text-sm text-neutral-500 sm:inline">{user.nickname}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-neutral-500 transition hover:text-crimson-500"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-lg bg-trust-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
            >
              로그인
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav row */}
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-neutral-100 px-6 py-2 sm:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 text-sm font-medium text-neutral-700 hover:text-neutral-900"
          >
            {item.label}
            {item.soon && (
              <span className="ml-1 rounded-full bg-spark-50 px-1.5 py-0.5 text-[10px] font-bold text-spark-600">
                준비중
              </span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  );
}
