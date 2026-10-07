import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import type { AppUser } from "@/lib/auth";
import { CONTACT_EMAIL } from "@/lib/site";

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
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-600">정책</h2>
          <nav className="mt-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={` px-3 py-2 text-sm font-medium transition ${
                  active === item.href
                    ? "bg-surface-1 text-ink-900"
                    : "text-ink-700 hover:bg-surface-1"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="min-w-0">
          <header className="border-b border-ink-200 pb-6">
            <h1 className="text-3xl font-bold text-ink-900">{title}</h1>
            <p className="mt-2 text-sm text-ink-600">시행일: {effectiveDate}</p>
          </header>

          <div className="prose prose-neutral mt-8 max-w-none text-[15px] leading-relaxed text-ink-900 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-ink-900 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_table]:my-4 [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-ink-200 [&_th]:bg-surface-1 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-ink-200 [&_td]:px-3 [&_td]:py-2 [&_strong]:font-semibold">
            {children}
          </div>

          <footer className="mt-12 border-t border-ink-200 pt-6 text-xs text-ink-600">
            전체 정책: <Link href="/policies" className="underline hover:text-ink-700">정책 인덱스</Link>
            {" · "}
            문의: <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-ink-700">{CONTACT_EMAIL}</a>
          </footer>
        </article>
      </main>
    </>
  );
}
