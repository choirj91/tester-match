import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import type { AppUser } from "@/lib/auth";

const NAV = [
  { href: "/policies/terms", label: "이용약관" },
  { href: "/policies/privacy", label: "개인정보처리방침" },
  { href: "/policies/refund", label: "환불 정책" },
  { href: "/policies/credits", label: "크레딧 운영" },
] as const;

type Props = {
  user: AppUser | null;
  active: (typeof NAV)[number]["href"];
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
};

export function PolicyLayout({ user, active, title, effectiveDate, children }: Props) {
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">정책</h2>
          <nav className="mt-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active === item.href
                    ? "bg-trust-50 text-trust-700"
                    : "text-neutral-700 hover:bg-neutral-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <header className="border-b border-neutral-200 pb-6">
            <h1 className="text-3xl font-bold text-neutral-900">{title}</h1>
            <p className="mt-2 text-sm text-neutral-500">시행일: {effectiveDate}</p>
            <div className="mt-4 rounded-lg bg-amber-500/10 px-4 py-3 text-xs text-amber-700">
              <strong>법적 효력 안내:</strong> 본 문서는 자체 초안 v0.1 입니다. 정식 출시 전 변호사 검토를 거쳐 v1.0 시행 예정.
            </div>
          </header>

          <div className="prose prose-neutral mt-8 max-w-none text-[15px] leading-relaxed text-neutral-800 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-neutral-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-neutral-900 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-neutral-200 [&_td]:px-3 [&_td]:py-2 [&_strong]:font-semibold">
            {children}
          </div>

          <footer className="mt-12 border-t border-neutral-200 pt-6 text-xs text-neutral-500">
            전체 정책: <Link href="/policies" className="underline hover:text-neutral-700">정책 인덱스</Link>
            {" · "}
            문의: <a href="mailto:support@testermatch.com" className="underline hover:text-neutral-700">support@testermatch.com</a>
          </footer>
        </article>
      </main>
    </>
  );
}
