import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SITE_URL, SITE_NAME } from "@/lib/site";
import { GUIDES } from "@/app/guide/guides";
import { NOTICE_CATEGORY } from "@/lib/validators/post";

export const runtime = "edge";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * RSS 2.0 피드 — 게시판 글(공지 제외) 최근 30건 + 출시 가이드.
 * 주기적 콘텐츠 발행의 검색엔진 디스커버리·구독 유입용.
 */
export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data: posts } = await supabase
    .from("posts")
    .select("id, title, body, category, created_at")
    .neq("category", NOTICE_CATEGORY)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  const items = [
    ...(posts ?? []).map((p) => ({
      title: `[${p.category}] ${p.title}`,
      url: `${SITE_URL}/board/${p.id}`,
      date: new Date(p.created_at),
      description: (p.body ?? "").replace(/\s+/g, " ").slice(0, 300),
    })),
    ...GUIDES.map((g) => ({
      title: `[가이드] ${g.title}`,
      url: `${SITE_URL}/guide/${g.slug}`,
      date: new Date(g.date),
      description: g.description,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(SITE_NAME)} — 인디 개발자 이야기와 출시 가이드</title>
  <link>${SITE_URL}</link>
  <description>앱 만드는 사람들의 수익 인증·개발기·실패담, 그리고 Google Play 출시 실전 가이드</description>
  <language>ko</language>
  <lastBuildDate>${(items[0]?.date ?? new Date()).toUTCString()}</lastBuildDate>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items
  .map(
    (it) => `  <item>
    <title>${esc(it.title)}</title>
    <link>${it.url}</link>
    <guid isPermaLink="true">${it.url}</guid>
    <pubDate>${it.date.toUTCString()}</pubDate>
    <description>${esc(it.description)}</description>
  </item>`,
  )
  .join("\n")}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=1800",
    },
  });
}
