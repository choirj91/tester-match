import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { GUIDES } from "./guides";

export const metadata = {
  alternates: { canonical: "/guide" },
  title: "출시 가이드",
  description:
    "Google Play 비공개 테스트(12명·14일), 테스터 그룹 설정, 프로덕션 액세스, ASO 까지 — 인디 안드로이드 개발자를 위한 실전 출시 가이드.",
};

export default async function GuideIndexPage() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-5 pt-12 pb-[88px]">
        <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">출시 가이드</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-700">
          Google Play 출시 관문을 넘는 데 필요한 것들을 실전 순서대로 정리했습니다.
          비공개 테스트 요건부터 출시 후 초기 노출까지.
        </p>

        <ol className="m-0 mt-10 list-none border-b border-ink-200 p-0">
          {GUIDES.map((g, i) => (
            <li key={g.slug}>
              <Link
                href={`/guide/${g.slug}`}
                className="group flex gap-5 border-t-[1.5px] border-ink-900 py-5 no-underline"
              >
                <span className="shrink-0 pt-0.5 font-mono text-[13px] text-ink-600 tabular-nums group-hover:text-accent-600">
                  STEP {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <h2 className="m-0 text-[17px] font-bold text-ink-900 group-hover:text-accent-600">
                    {g.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{g.description}</p>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </main>
    </>
  );
}
