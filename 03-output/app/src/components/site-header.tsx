"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AppUser } from "@/lib/auth";
import { formatKrw } from "@/lib/credits";
import { NotificationBell } from "@/components/notification-bell";
import { LogoMark } from "@/components/logo";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import {
  NAV_SECTIONS,
  activeSection,
  isActiveLink,
  sectionHref,
  type NavSection,
} from "@/components/site-nav";
import { cx } from "@/components/ui/cx";

/**
 * 헤더 (Design C §5.13) — 높이 64px, 1차 메뉴 4개.
 * 1차 메뉴에 올리거나 포커스하면 2차 메뉴가 드롭다운이 아니라 헤더 아래 한 줄로 펼쳐진다.
 * 760px 이하에서는 로그인(또는 알림) + 햄버거, 하단 탭 바.
 */
export function SiteHeader({ user }: { user: AppUser | null }) {
  const pathname = usePathname() ?? "";
  const active = activeSection(pathname);
  const [hovered, setHovered] = useState<NavSection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const shown = hovered ?? active;
  const signedIn = Boolean(user);

  // 페이지가 바뀌면 열린 메뉴를 닫는다
  useEffect(() => {
    setMenuOpen(false);
    setHovered(null);
  }, [pathname]);

  return (
    <>
      <header className="border-b border-ink-900 bg-white" onMouseLeave={() => setHovered(null)}>
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 font-display text-xl font-semibold tracking-[-0.01em] text-ink-900 no-underline"
          >
            <LogoMark size={26} />
            <span>Tester Match</span>
          </Link>

          <nav aria-label="주 메뉴" className="hidden items-center gap-0.5 min-[761px]:flex">
            {NAV_SECTIONS.map((section) => (
              <Link
                key={section.key}
                href={sectionHref(section, signedIn)}
                onMouseEnter={() => setHovered(section)}
                onFocus={() => setHovered(section)}
                aria-current={active?.key === section.key ? "true" : undefined}
                className={cx(
                  "px-3.5 py-2.5 text-[15px] font-medium text-ink-900 no-underline hover:text-accent-600",
                  active?.key === section.key && "underline decoration-[1.5px] underline-offset-[6px]",
                )}
              >
                {section.label}
              </Link>
            ))}
            <UserControls user={user} />
          </nav>

          <div className="flex items-center gap-2 min-[761px]:hidden">
            {user ? (
              <NotificationBell />
            ) : (
              <Link
                href="/auth/login"
                className="flex min-h-11 items-center border-[1.5px] border-ink-900 px-4 text-sm font-medium text-ink-900 no-underline"
              >
                로그인
              </Link>
            )}
            <button
              type="button"
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex size-11 items-center justify-center border-[1.5px] border-ink-900 bg-white"
            >
              {menuOpen ? (
                <X className="size-5" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {shown && !menuOpen && (
          <nav aria-label={`${shown.label} 메뉴`} className="border-t border-ink-900">
            <ul className="mx-auto flex max-w-[1200px] list-none gap-1 overflow-x-auto px-5">
              {shown.links.map((link) => {
                const current = isActiveLink(pathname, link.href);
                return (
                  <li key={link.href} className="shrink-0">
                    <Link
                      href={link.href}
                      aria-current={current ? "page" : undefined}
                      className={cx(
                        "flex min-h-11 items-center px-2.5 text-[15px] whitespace-nowrap no-underline hover:text-accent-600",
                        current ? "font-bold text-ink-900" : "text-ink-700",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div id="mobile-menu" hidden={!menuOpen} className="border-t border-ink-900 min-[761px]:hidden">
          <MobileMenu user={user} pathname={pathname} />
        </div>
      </header>
      <MobileTabBar signedIn={signedIn} activeKey={active?.key ?? null} />
    </>
  );
}

function UserControls({ user }: { user: AppUser | null }) {
  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="ml-2.5 flex min-h-11 items-center border-[1.5px] border-ink-900 px-[18px] text-[15px] font-medium text-ink-900 no-underline hover:bg-surface-1"
      >
        로그인
      </Link>
    );
  }
  return (
    <div className="ml-2.5 flex items-center gap-1">
      <NotificationBell />
      <CreditChip balance={user.balance} />
      {user.role === "admin" && (
        <Link
          href="/admin"
          className="flex min-h-11 items-center px-2.5 text-sm font-medium text-accent-600 no-underline hover:underline"
        >
          관리자
        </Link>
      )}
      <Link
        href="/profile"
        className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-ink-900 no-underline hover:text-accent-600"
      >
        <span>{user.nickname}</span>
        <span className="font-mono text-xs text-ink-600 tabular-nums">신뢰도 {user.trustScore}</span>
      </Link>
      <SignOutButton />
    </div>
  );
}

function CreditChip({ balance }: { balance: number }) {
  return (
    <Link
      href="/credits"
      title="크레딧 잔액"
      className="flex min-h-11 items-center px-2.5 font-mono text-[13px] text-ink-900 no-underline tabular-nums hover:text-accent-600"
    >
      <span className="border border-ink-900 px-2 py-1">크레딧 {formatKrw(balance)}</span>
    </Link>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={cx("min-h-11 px-2 text-sm text-ink-600 hover:text-danger-700", className)}
      >
        로그아웃
      </button>
    </form>
  );
}

function MobileMenu({ user, pathname }: { user: AppUser | null; pathname: string }) {
  const signedIn = Boolean(user);
  return (
    <div className="flex flex-col gap-5 px-5 pt-4 pb-6">
      {user && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-200 pb-4">
          <Link href="/profile" className="flex items-center gap-2 text-[15px] text-ink-900 no-underline">
            <span className="font-medium">{user.nickname}</span>
            <span className="font-mono text-xs text-ink-600">신뢰도 {user.trustScore}</span>
          </Link>
          <CreditChip balance={user.balance} />
        </div>
      )}
      {NAV_SECTIONS.map((section) => (
        <div key={section.key} className="flex flex-col">
          <span className="font-mono text-xs text-ink-600">{section.label}</span>
          <ul className="m-0 flex list-none flex-wrap gap-x-4 p-0">
            {section.links.map((link) => {
              const href = section.requiresAuth && !signedIn ? "/auth/login" : link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={href}
                    aria-current={isActiveLink(pathname, link.href) ? "page" : undefined}
                    className="flex min-h-11 items-center text-base font-medium text-ink-900 no-underline aria-[current=page]:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {user && (
        <div className="flex items-center justify-between border-t border-ink-200 pt-4">
          {user.role === "admin" ? (
            <Link href="/admin" className="flex min-h-11 items-center text-sm font-medium text-accent-600">
              관리자
            </Link>
          ) : (
            <span />
          )}
          <SignOutButton />
        </div>
      )}
    </div>
  );
}
