import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "edge";

const SITE_URL = "https://tester-match.pages.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticUrls: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/browse`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/board`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
    { url: `${SITE_URL}/boost`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/policies/refund`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/policies/credits`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const supabase = createSupabaseAdminClient();

    const [{ data: apps }, { data: posts }] = await Promise.all([
      supabase
        .from("apps")
        .select("id, updated_at")
        .in("status", ["matching", "reviewing", "launched"])
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1000),
      supabase
        .from("posts")
        .select("id, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1000),
    ]);

    const appUrls: MetadataRoute.Sitemap = (apps ?? []).map((a) => ({
      url: `${SITE_URL}/browse/${a.id}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : now,
      changeFrequency: "daily",
      priority: 0.6,
    }));

    const postUrls: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
      url: `${SITE_URL}/board/${p.id}`,
      lastModified: p.updated_at ? new Date(p.updated_at) : now,
      changeFrequency: "weekly",
      priority: 0.5,
    }));

    return [...staticUrls, ...appUrls, ...postUrls];
  } catch (e) {
    console.error("[sitemap] fallback to static", e);
    return staticUrls;
  }
}
