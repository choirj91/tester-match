import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { GUIDES, getGuide } from "../guides";
import { ButtonLink } from "@/components/ui/button";
import { PLAY_CLOSED_TEST_TESTERS } from "@/lib/site";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guide/${slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `https://tester-match.knockknock.company/guide/${slug}`,
      type: "article",
    },
  };
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.date,
    inLanguage: "ko",
    author: { "@type": "Organization", name: "Tester Match" },
    publisher: { "@type": "Organization", name: "Knock Knock Company" },
    mainEntityOfPage: `https://tester-match.knockknock.company/guide/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[720px] px-5 pt-12 pb-[88px]">
        <Link href="/guide" className="inline-flex min-h-11 items-center text-sm text-ink-700 hover:text-accent-600">
          ← 출시 가이드
        </Link>
        <h1 className="mt-2 font-display text-h1 font-semibold text-ink-900">{guide.title}</h1>
        <p className="mt-3 text-[13px] text-ink-600">
          <span className="tabular">{new Date(guide.date).toLocaleDateString("ko-KR")}</span> · Tester Match
        </p>

        <article
          className="mt-8 max-w-none border-t border-ink-900 pt-2 text-base leading-[1.8] text-ink-700
            [&_code]:bg-surface-1 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink-900
            [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-h3 [&_h2]:font-semibold [&_h2]:text-ink-900
            [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5
            [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-ink-900
            [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5"
        >
          {guide.body}
        </article>

        <nav
          aria-label="이전·다음 가이드"
          className="mt-12 flex flex-col gap-3 border-t border-ink-900 pt-6 sm:flex-row sm:justify-between"
        >
          {prev ? (
            <Link href={`/guide/${prev.slug}`} className="text-sm text-ink-900 underline hover:text-accent-600">
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/guide/${next.slug}`}
              className="text-sm text-ink-900 underline hover:text-accent-600 sm:text-right"
            >
              {next.title} →
            </Link>
          )}
        </nav>

        <div className="mt-10 flex flex-col items-center gap-4 border-[1.5px] border-ink-900 p-6 text-center">
          <p className="m-0 font-display text-h3 font-semibold text-ink-900">
            테스터 <span className="font-mono">{PLAY_CLOSED_TEST_TESTERS}</span>명, 품앗이로 채워보세요
          </p>
          <ButtonLink href="/apps/new">앱 등록하기 →</ButtonLink>
        </div>
      </main>
    </>
  );
}
