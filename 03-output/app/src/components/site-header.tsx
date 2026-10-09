"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 *
 * 2차 줄은 올린 1차 메뉴 바로 아래에서 시작한다(마우스를 곧게 내리면 닿게).
 * 대각선으로 내려가다 다른 1차 메뉴를 스쳐도 바뀌지 않게 전환을 잠깐 늦추고,
 * 헤더 밖으로 살짝 벗어나도 바로 닫히지 않게 닫기를 늦춘다.
 */
/** 다른 1차 메뉴로 바꾸기 전 기다리는 시간 — 지나가며 스친 메뉴는 무시 */
const SWITCH_DELAY_MS = 150;
/** 헤더를 벗어난 뒤 2차 줄을 닫기까지 기다리는 시간 */
const CLOSE_DELAY_MS = 300;
/** 2차 줄 오른쪽 여백 (컨테이너 px-5) */
const ROW_GUTTER_PX = 20;

type Timer = ReturnType<typeof setTimeout> | null;

function clearTimer(ref: { current: Timer }) {
  if (ref.current) clearTimeout(ref.current);
  ref.current = null;
}
export function SiteHeader({ user }: { user: AppUser | null }) {
  const pathname = usePathname() ?? "";
  const active = activeSection(pathname);
  const [hovered, setHovered] = useState<NavSection | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const shown = hovered ?? active;
  const signedIn = Boolean(user);

  const containerRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLUListElement>(null);
  const linkRefs = useRef(new Map<NavSection["key"], HTMLAnchorElement>());
  const switchTimer = useRef<Timer>(null);
  const closeTimer = useRef<Timer>(null);
  const [rowOffset, setRowOffset] = useState(0);

  useEffect(
    () => () => {
      clearTimer(switchTimer);
      clearTimer(closeTimer);
    },
    [],
  );

  const enterSection = useCallback(
    (section: NavSection, immediate = false) => {
      clearTimer(closeTimer);
      clearTimer(switchTimer);
      if (immediate || hovered === null || hovered.key === section.key) {
        setHovered(section);
        return;
      }
      switchTimer.current = setTimeout(() => setHovered(section), SWITCH_DELAY_MS);
    },
    [hovered],
  );

  // 2차 줄을 올린 1차 메뉴의 왼쪽 끝에 맞춘다. 넘치면 오른쪽 여백 안으로 당긴다
  useLayoutEffect(() => {
    const container = containerRef.current;
    const link = shown ? linkRefs.current.get(shown.key) : undefined;
    const row = rowRef.current;
    if (!container || !link || !row || link.offsetWidth === 0) {
      setRowOffset(0);
      return;
    }
    const containerBox = container.getBoundingClientRect();
    const linkLeft = link.getBoundingClientRect().left - containerBox.left;
    const itemsWidth = Array.from(row.children).reduce(
      (sum, li) => sum + (li as HTMLElement).offsetWidth,
      0,
    );
    const maxOffset = containerBox.width - itemsWidth - ROW_GUTTER_PX;
    setRowOffset(Math.max(0, Math.min(linkLeft, maxOffset)));
  }, [shown]);

  // 페이지가 바뀌면 열린 메뉴를 닫는다
  useEffect(() => {
    setMenuOpen(false);
    setHovered(null);
  }, [pathname]);

  return (
    <>
      <header
        className="border-b border-ink-900 bg-white"
        onMouseEnter={() => clearTimer(closeTimer)}
        onMouseLeave={() => {
          clearTimer(switchTimer);
          closeTimer.current = setTimeout(() => setHovered(null), CLOSE_DELAY_MS);
        }}
      >
        <div ref={containerRef} className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-5">
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
                ref={(el) => {
                  if (el) linkRefs.current.set(section.key, el);
                  else linkRefs.current.delete(section.key);
                }}
                onMouseEnter={() => enterSection(section)}
                onMouseLeave={() => clearTimer(switchTimer)}
                onFocus={() => enterSection(section, true)}
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
          <nav
            aria-label={`${shown.label} 메뉴`}
            className="border-t border-ink-900"
            onMouseEnter={() => clearTimer(switchTimer)}
          >
            <ul
              ref={rowRef}
              className="mx-auto flex max-w-[1200px] list-none gap-1 overflow-x-auto px-5"
              style={rowOffset > 0 ? { paddingLeft: rowOffset } : undefined}
            >
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
