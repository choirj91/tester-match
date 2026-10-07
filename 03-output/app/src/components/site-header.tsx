import Link from "next/link";
import type { AppUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { NotificationBell } from "@/components/notification-bell";
import { LogoMark } from "@/components/logo";

type NavItem = { href: string; label: string; soon?: boolean };

const NAV: readonly NavItem[] = [
  { href: "/browse", label: "매칭 가능" },
  { href: "/paid-testers", label: "급구" },
  { href: "/board", label: "게시판" },
  { href: "/guide", label: "가이드" },
  { href: "/stats", label: "랭킹" },
  { href: "/my-tests", label: "내 테스트" },
  { href: "/my-reviews", label: "맞테스트" },
  { href: "/apps", label: "내 앱" },
  { href: "/rewards", label: "보상" },
  { href: "/credits", label: "크레딧" },
  { href: "/profile", label: "프로필" },
];

export function SiteHeader({ user }: { user: AppUser | null }) {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-ink-900"
        >
          <LogoMark size={28} />
          <span>
            Tester <span className="text-ink-900">Match</span>
          </span>
        </Link>

        {/* 메뉴가 한 줄에 다 들어가는 폭(xl)부터 보인다. 더 좁으면 아래 둘째 줄 메뉴(가로 스크롤)를 쓴다 */}
        <nav className="hidden min-w-0 flex-1 items-center gap-5 xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 text-sm font-medium whitespace-nowrap text-ink-700 hover:text-ink-900"
            >
              {item.label}
              {item.soon && (
                <span className="ml-1.5 bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-600">
                  준비중
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-4">
          {user ? (
            <>
              <NotificationBell />
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="hidden bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-600 hover:bg-accent-50 sm:inline-flex"
                  title="관리자"
                >
                  관리자
                </Link>
              )}
              <Link
                href="/credits"
                className="hidden bg-surface-1 px-3 py-1 text-xs font-semibold text-ink-900 hover:bg-surface-1 sm:inline-flex tabular"
                title="크레딧 잔액"
              >
                {formatKrw(user.balance)} ⓒ
              </Link>
              <Link
                href="/profile"
                className="hidden items-baseline gap-1.5 sm:inline-flex"
              >
                <span className="text-sm text-ink-600 hover:text-ink-900">
                  {user.nickname}
                </span>
                <span className="text-[11px] font-semibold text-accent-600">
                  ★{user.trustScore}
                </span>
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-ink-600 transition hover:text-danger-700"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/auth/login"
              className="bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              로그인
            </Link>
          )}
        </div>
      </div>

      {/* Mobile·좁은 화면 nav row */}
      <nav className="flex items-center gap-4 overflow-x-auto border-t border-ink-200 px-6 py-2 xl:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 text-sm font-medium text-ink-700 hover:text-ink-900"
          >
            {item.label}
            {item.soon && (
              <span className="ml-1 bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold text-accent-600">
                준비중
              </span>
            )}
          </Link>
        ))}
      </nav>
    </header>
  );
}
