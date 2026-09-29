import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "edge";
export const metadata = {
  title: { default: "테스트 콘솔", template: "%s | 테스트 콘솔" },
  robots: { index: false, follow: false },
};

/**
 * 유료 테스터 콘솔 셸 — 본 사이트와 분리된 대시보드 레이아웃.
 * 구매자·관리자 공용, 역할에 따라 사이드 네비만 달라진다.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/console");
  const isAdmin = user.role === "admin";

  const nav = [
    { href: "/console", label: "대시보드", icon: "▦" },
    ...(isAdmin
      ? [
          { href: "/admin/paid-orders", label: "주문 관리", icon: "≡" },
          { href: "/admin", label: "관리자 홈", icon: "⚙" },
        ]
      : [{ href: "/paid-testers", label: "유료 테스터 신청", icon: "+" }]),
  ];

  return (
    <div className="flex min-h-screen bg-neutral-100 text-neutral-900">
      <aside className="hidden w-60 shrink-0 flex-col bg-neutral-950 text-neutral-300 md:flex">
        <Link href="/console" className="flex h-14 items-center gap-2 border-b border-neutral-800 px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-trust-600 text-xs font-black text-white">
            TM
          </span>
          <span className="text-sm font-bold text-white">테스트 콘솔</span>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-neutral-800 hover:text-white"
            >
              <span className="w-4 text-center text-neutral-500">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-neutral-800 px-5 py-4 text-xs text-neutral-500">
          <p className="truncate text-neutral-300">{user.nickname}</p>
          <p className="mt-0.5">{isAdmin ? "운영자" : "구매자"}</p>
          <Link href="/" className="mt-3 inline-block hover:text-white">
            ← 사이트로 돌아가기
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/console" className="text-sm font-bold">
              테스트 콘솔
            </Link>
          </div>
          <p className="hidden text-xs text-neutral-500 md:block">
            유료 테스터 이행 현황 — 출석 · 스크린샷 · 코멘트
          </p>
          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700">
              {isAdmin ? "운영자" : "구매자"} · {user.nickname}
            </span>
            <Link href="/" className="text-neutral-500 hover:text-neutral-900 md:hidden">
              사이트 ↗
            </Link>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
