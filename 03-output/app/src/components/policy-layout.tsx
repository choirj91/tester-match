import Link from "next/link";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
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

type TocItem = { id: string; label: string };

const LINK = "text-ink-900 underline underline-offset-2 hover:text-accent-600";

/** 본문 조판 — 16px / 1.8, 조(h2)는 세리프, 표는 괘선 */
const BODY =
  "text-base leading-[1.8] text-ink-900 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-accent-600 [&_h2]:mt-12 [&_h2]:mb-0 [&_h2]:scroll-mt-24 [&_h2]:border-t [&_h2]:border-ink-900 [&_h2]:pt-5 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink-900 [&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1.5 [&_table]:my-5 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:border [&_table]:border-ink-900 [&_table]:text-sm [&_table]:leading-relaxed [&_th]:border-b [&_th]:border-ink-900 [&_th]:bg-surface-1 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-mono [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_td]:border-b [&_td]:border-ink-200 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_strong]:font-bold";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** 본문의 조(h2)에 앵커를 붙이고 목차를 만든다 — 문구는 건드리지 않는다 */
function withToc(children: ReactNode): { body: ReactNode[]; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const body = Children.toArray(children).map((child) => {
    if (!isValidElement(child) || child.type !== "h2") return child;
    const h2 = child as ReactElement<{ id?: string; children?: ReactNode }>;
    const id = h2.props.id ?? `section-${toc.length + 1}`;
    toc.push({ id, label: textOf(h2.props.children) });
    return cloneElement(h2, { id });
  });
  return { body, toc };
}

export function PolicyLayout({ user, active, title, effectiveDate, children }: Props) {
  const { body, toc } = withToc(children);
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto grid max-w-[1200px] gap-10 px-5 pt-12 pb-16 min-[1024px]:grid-cols-[220px_minmax(0,720px)] min-[1024px]:gap-16">
        <aside className="min-[1024px]:sticky min-[1024px]:top-8 min-[1024px]:self-start">
          <nav aria-label="정책">
            <h2 className="text-ink-600 m-0 font-mono text-xs">정책</h2>
            <ul className="border-ink-900 m-0 mt-3 list-none border-t p-0">
              {NAV.map((item) => {
                const isActive = active === item.href;
                return (
                  <li key={item.href} className="border-ink-200 border-b">
                    <Link
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`hover:text-accent-600 flex min-h-11 items-center text-sm no-underline ${
                        isActive ? "text-ink-900 font-bold" : "text-ink-700 font-medium"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <article className="min-w-0">
          <header className="border-ink-900 flex flex-col gap-2 border-b-[1.5px] pb-6">
            <h1 className="font-display text-h1 text-ink-900 m-0 font-semibold">{title}</h1>
            <p className="text-ink-600 m-0 font-mono text-[13px] tabular-nums">
              시행일: {effectiveDate}
            </p>
          </header>

          {toc.length > 0 && (
            <nav aria-label="목차" className="mt-8">
              <ol className="border-ink-900 m-0 list-none border-t p-0">
                {toc.map((item) => (
                  <li key={item.id} className="border-ink-200 border-b">
                    <a
                      href={`#${item.id}`}
                      className="text-ink-900 hover:text-accent-600 flex min-h-11 items-center text-[15px] no-underline"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className={`mt-8 ${BODY}`}>{body}</div>

          <footer className="border-ink-900 text-ink-600 mt-12 border-t pt-6 text-[13px]">
            전체 정책:{" "}
            <Link href="/policies" className={LINK}>
              정책 인덱스
            </Link>
            {" · "}
            문의:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
              {CONTACT_EMAIL}
            </a>
          </footer>
        </article>
      </main>
    </>
  );
}
