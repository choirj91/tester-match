import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "edge";

const Body = z.object({
  url: z.string().url("URL 형식이 올바르지 않습니다."),
});

/**
 * F-APP-03 — Play Store URL 자동 파싱.
 *
 * 개발자가 Play Store 앱 상세 URL 을 붙여넣으면 앱 이름, 설명, 아이콘,
 * 패키지 ID, 초대 링크(2종) 를 자동 추출.
 */
export async function POST(req: Request) {
  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "잘못된 요청";
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(body.url);
  } catch {
    return NextResponse.json({ ok: false, message: "URL 파싱 실패" }, { status: 400 });
  }

  if (!/(^|\.)play\.google\.com$/.test(target.hostname)) {
    return NextResponse.json(
      { ok: false, message: "play.google.com 도메인의 URL 이어야 합니다." },
      { status: 400 },
    );
  }

  const packageId = target.searchParams.get("id") || extractIdFromPath(target.pathname);
  if (!packageId || !/^[a-zA-Z0-9._]+$/.test(packageId)) {
    return NextResponse.json(
      { ok: false, message: "URL 에서 패키지 ID 를 찾지 못했습니다." },
      { status: 400 },
    );
  }

  const canonicalUrl = `https://play.google.com/store/apps/details?id=${packageId}&hl=ko&gl=KR`;

  try {
    const res = await fetch(canonicalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TesterMatch/1.0; +https://tester-match.pages.dev)",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { ok: false, message: "해당 앱을 Play Store 에서 찾지 못했습니다." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { ok: false, message: `Play Store 응답 오류 (${res.status})` },
        { status: 502 },
      );
    }
    const html = await res.text();

    const meta = extractMeta(html);
    const cleanTitle = cleanupTitle(meta.title);

    return NextResponse.json({
      ok: true,
      data: {
        package_id: packageId,
        name: cleanTitle,
        short_description: meta.description,
        icon_url: meta.image,
        store_invite_url: `https://play.google.com/store/apps/details?id=${packageId}`,
        web_invite_url: `https://play.google.com/apps/testing/${packageId}`,
      },
    });
  } catch (err) {
    console.error("[parse-play-store] fetch failed", err);
    return NextResponse.json(
      { ok: false, message: "Play Store 페이지를 불러오지 못했습니다." },
      { status: 502 },
    );
  }
}

function extractIdFromPath(pathname: string): string | null {
  // Some Play Store URLs may look like /store/apps/details/id/com.example
  const m = pathname.match(/\/(?:details|apps\/testing)\/(?:id\/)?([a-zA-Z0-9._]+)/);
  return m?.[1] ?? null;
}

function extractMeta(html: string): {
  title: string;
  description: string;
  image: string;
} {
  const title = matchMeta(html, "og:title") ?? matchTitleTag(html) ?? "";
  const description = matchMeta(html, "og:description") ?? matchMeta(html, "description") ?? "";
  const image = matchMeta(html, "og:image") ?? "";
  return { title: unescape(title), description: unescape(description), image };
}

function matchMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*property=["']${escapeRegex(name)}["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+name=["']${escapeRegex(name)}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return null;
}

function matchTitleTag(html: string): string | null {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m?.[1] ?? null;
}

function cleanupTitle(t: string): string {
  return t
    .replace(/\s*[-–—]\s*Google Play.*$/i, "")
    .replace(/\s*[-–—]\s*Apps on Google Play.*$/i, "")
    .replace(/\s*[-–—]\s*Android.*$/i, "")
    .trim();
}

function unescape(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
