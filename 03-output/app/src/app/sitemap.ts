import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GUIDES } from "@/app/guide/guides";

export const runtime = "edge";

const SITE_URL = "https://tester-match.knockknock.company";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/board`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/boost`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/guide`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guide/${g.slug}`,
      lastModified: new Date(g.date),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/stats`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/policies/refund`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/policies/credits`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const supabase = createSupabaseAdminClient();

    // /browse/[id] 는 sitemap 에서 제외한다 — 스토어 설명을 그대로 싣는 기능
    // 페이지라 색인 대상이 아니다 (page.tsx 에서 noindex).
    const { data: posts } = await supabase
      .from("posts")
      .select("id, updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1000);

    const postUrls: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${SITE_URL}/board/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...staticUrls, ...postUrls];
  } catch (e) {
    console.error("[sitemap] fallback to static", e);
    return staticUrls;
  }
}
