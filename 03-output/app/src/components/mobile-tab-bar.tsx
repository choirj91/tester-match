"use client";

import { FlaskConical, MessagesSquare, User, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NAV_SECTIONS, sectionHref, type NavSection } from "@/components/site-nav";

const ICON: Record<NavSection["key"], LucideIcon> = {
  test: FlaskConical,
  recruit: Users,
  community: MessagesSquare,
  me: User,
};

/** 화면 높이가 이 비율 아래로 줄면 소프트 키보드가 열린 것으로 본다 */
const KEYBOARD_VIEWPORT_RATIO = 0.75;

/** 760px 이하 고정 하단 탭 바 (Design C §5.14). 키보드가 열리면 숨긴다 */
export function MobileTabBar({
  signedIn,
  activeKey,
}: {
  signedIn: boolean;
  activeKey: NavSection["key"] | null;
}) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardOpen(vv.height < window.innerHeight * KEYBOARD_VIEWPORT_RATIO);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  if (keyboardOpen) return null;

  return (
    <nav
      aria-label="하단 탭"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-900 bg-white pb-[env(safe-area-inset-bottom)] min-[761px]:hidden"
    >
      <ul className="m-0 grid h-14 list-none grid-cols-4 p-0">
        {NAV_SECTIONS.map((section) => {
          const Icon = ICON[section.key];
          const active = activeKey === section.key;
          return (
            <li key={section.key}>
              <Link
                href={sectionHref(section, signedIn)}
                aria-current={active ? "page" : undefined}
                className={
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium no-underline " +
                  (active ? "text-ink-900" : "text-ink-600")
                }
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
