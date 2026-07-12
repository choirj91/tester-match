import type { MetadataRoute } from "next";

const SITE_URL = "https://tester-match.pages.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/auth/", "/admin/", "/apps/", "/api/", "/notifications", "/credits", "/my-tests", "/my-reviews", "/profile"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
