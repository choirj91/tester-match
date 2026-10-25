// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => ({ id: 1 }),
}));

import { POST } from "./route";

const PKG = "com.example.closedtest";

function post(url: string) {
  return POST(
    new Request("http://localhost/api/apps/parse-play-store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    }),
  );
}

function stubPlayStore(status: number, html = "") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(html, { status })),
  );
}

describe("POST /api/apps/parse-play-store", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fills metadata and invite links when the store page is public", async () => {
    stubPlayStore(
      200,
      `<meta property="og:title" content="My App - Apps on Google Play">` +
        `<meta property="og:description" content="A short pitch">` +
        `<meta property="og:image" content="https://img.example/icon.png">`,
    );

    const res = await post(`https://play.google.com/store/apps/details?id=${PKG}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      found: true,
      data: {
        package_id: PKG,
        name: "My App",
        short_description: "A short pitch",
        icon_url: "https://img.example/icon.png",
        store_invite_url: `https://play.google.com/store/apps/details?id=${PKG}`,
        web_invite_url: `https://play.google.com/apps/testing/${PKG}`,
      },
    });
  });

  // 비공개 테스트만 한 앱은 로그인 없는 서버 요청에 404 를 준다.
  it("still returns both invite links when the store page is hidden (404)", async () => {
    stubPlayStore(404);

    const res = await post(`https://play.google.com/store/apps/details?id=${PKG}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      found: false,
      data: {
        package_id: PKG,
        name: "",
        short_description: "",
        icon_url: "",
        store_invite_url: `https://play.google.com/store/apps/details?id=${PKG}`,
        web_invite_url: `https://play.google.com/apps/testing/${PKG}`,
      },
    });
  });

  it("accepts the web opt-in link and still returns invite links on 404", async () => {
    stubPlayStore(404);

    const res = await post(`https://play.google.com/apps/testing/${PKG}`);
    const body = await res.json();

    expect(body).toMatchObject({
      ok: true,
      found: false,
      data: { web_invite_url: `https://play.google.com/apps/testing/${PKG}` },
    });
  });

  it("reports other upstream errors as 502 without invite links", async () => {
    stubPlayStore(500);

    const res = await post(`https://play.google.com/store/apps/details?id=${PKG}`);
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body).toEqual({ ok: false, message: "Play Store 응답 오류 (500)" });
  });
});
