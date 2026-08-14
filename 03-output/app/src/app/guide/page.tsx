import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { GUIDES } from "./guides";

export const runtime = "edge";
export const metadata = {
  title: "출시 가이드",
  description:
    "Google Play 비공개 테스트(12명·14일), 테스터 그룹 설정, 프로덕션 액세스, ASO 까지 — 인디 안드로이드 개발자를 위한 실전 출시 가이드.",
};

export default async function GuideIndexPage() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-neutral-900">출시 가이드</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Google Play 출시 관문을 넘는 데 필요한 것들을 실전 순서대로 정리했습니다.
          비공개 테스트 요건부터 출시 후 초기 노출까지.
        </p>

        <ul className="mt-8 space-y-4">
          {GUIDES.map((g, i) => (
            <li key={g.slug}>
              <Link
                href={`/guide/${g.slug}`}
                className="block rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-trust-500/40 hover:shadow"
              >
                <p className="text-xs font-semibold text-trust-600">STEP {i + 1}</p>
                <h2 className="mt-1 text-base font-bold text-neutral-900">{g.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">
                  {g.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
