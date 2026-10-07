import { LayoutDashboard, ListOrdered, Plus, Settings, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: { default: "테스트 콘솔", template: "%s | 테스트 콘솔" },
  robots: { index: false, follow: false },
};

type NavItem = { href: string; label: string; icon: LucideIcon };

/**
 * 유료 테스터 콘솔 셸 — 본 사이트와 분리된 대시보드 레이아웃.
 * 구매자·관리자 공용, 역할에 따라 사이드 네비만 달라진다.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/console");
  const isAdmin = user.role === "admin";

  const nav: NavItem[] = [
    { href: "/console", label: "대시보드", icon: LayoutDashboard },
    ...(isAdmin
      ? [
          { href: "/admin/paid-orders", label: "주문 관리", icon: ListOrdered },
          { href: "/admin", label: "관리자 홈", icon: Settings },
        ]
      : [{ href: "/paid-testers", label: "유료 테스터 신청", icon: Plus }]),
  ];

  return (
    <div className="flex min-h-screen bg-white text-ink-900">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-900 bg-white md:flex">
        <Link
          href="/console"
          className="flex h-16 items-center gap-2.5 border-b border-ink-900 px-5 text-ink-900 no-underline"
        >
          <LogoMark />
          <span className="font-display text-base font-semibold">테스트 콘솔</span>
        </Link>
        <nav className="flex-1 px-3 py-4">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 px-3 text-sm text-ink-900 no-underline hover:bg-surface-1 hover:text-accent-600"
                >
                  <item.icon className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-ink-900 px-5 py-4 text-xs text-ink-600">
          <p className="m-0 truncate text-sm font-medium text-ink-900">{user.nickname}</p>
          <p className="m-0 mt-0.5">{isAdmin ? "운영자" : "구매자"}</p>
          <Link
            href="/"
            className="mt-3 inline-flex min-h-11 items-center text-ink-900 underline hover:text-accent-600"
          >
            ← 사이트로 돌아가기
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-ink-900 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2.5 md:hidden">
            <Link href="/console" className="flex items-center gap-2 text-ink-900 no-underline">
              <LogoMark size={22} />
              <span className="font-display text-sm font-semibold">테스트 콘솔</span>
            </Link>
          </div>
          <p className="m-0 hidden text-xs text-ink-600 md:block">
            유료 테스터 이행 현황 — 출석 · 스크린샷 · 코멘트
          </p>
          <div className="flex items-center gap-3 text-xs">
            <Badge tone="outline">
              {isAdmin ? "운영자" : "구매자"} · {user.nickname}
            </Badge>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center text-ink-900 underline hover:text-accent-600 md:hidden"
            >
              사이트 ↗
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
