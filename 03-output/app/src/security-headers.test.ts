import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

async function headersForAllPaths(): Promise<Record<string, string>> {
  const rules = (await nextConfig.headers?.()) ?? [];
  const all = rules.find((r) => r.source === "/:path*");
  return Object.fromEntries((all?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
}

describe("security headers", () => {
  it("sends HSTS, nosniff and frame blocking on every path", async () => {
    const h = await headersForAllPaths();
    expect(h["strict-transport-security"]).toMatch(/max-age=31536000/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("object-src 'none'");
    expect(h["content-security-policy"]).toContain("base-uri 'self'");
  });

  it("keeps script sources report-only so AdSense and PortOne keep working", async () => {
    const h = await headersForAllPaths();
    expect(h["content-security-policy"]).not.toContain("script-src");
    expect(h["content-security-policy-report-only"]).toContain("script-src 'self'");
    expect(h["content-security-policy-report-only"]).toContain("https://pagead2.googlesyndication.com");
    expect(h["content-security-policy-report-only"]).toContain("https://cdn.portone.io");
  });

  it("leaves tag manager hosts the site never loads out of the allowlist", async () => {
    const h = await headersForAllPaths();
    expect(h["content-security-policy-report-only"]).not.toContain("googletagmanager");
  });
});
