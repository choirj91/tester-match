import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { GUIDES, getGuide } from "../guides";

export const runtime = "edge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return { title: guide.title, description: guide.description };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const idx = GUIDES.findIndex((g) => g.slug === slug);
  const prev = GUIDES[idx - 1];
  const next = GUIDES[idx + 1];
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/guide" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 출시 가이드
        </Link>
        <h1 className="mt-4 text-2xl font-bold leading-snug text-neutral-900">{guide.title}</h1>
        <p className="mt-2 text-xs text-neutral-400">
          {new Date(guide.date).toLocaleDateString("ko-KR")} · Tester Match
        </p>

        <article
          className="prose-sm mt-8 max-w-none text-sm leading-7 text-neutral-700
            [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px]
            [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-neutral-900
            [&_li]:mt-1.5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5
            [&_p]:mt-3 [&_strong]:font-semibold [&_strong]:text-neutral-900
            [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {guide.body}
        </article>

        <nav className="mt-12 flex flex-col gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:justify-between">
          {prev ? (
            <Link href={`/guide/${prev.slug}`} className="text-sm text-trust-600 hover:underline">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/guide/${next.slug}`}
              className="text-sm text-trust-600 hover:underline sm:text-right"
            >
              {next.title} →
            </Link>
          )}
        </nav>

        <div className="mt-10 rounded-2xl border border-trust-500/30 bg-trust-50 p-6 text-center">
          <p className="text-sm font-semibold text-neutral-900">
            테스터 12명, 품앗이로 채워보세요
          </p>
          <Link
            href="/apps/new"
            className="mt-3 inline-block rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
          >
            앱 등록하기 →
          </Link>
        </div>
      </main>
    </>
  );
}
