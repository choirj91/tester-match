import type { NextConfig } from "next";

// Enforced CSP holds only directives that cannot break AdSense or the PortOne checkout.
// Script sources stay report-only until browser reports show the allowlist is complete;
// tag manager hosts are left out on purpose because the site does not load any.
const SCRIPT_SOURCES = [
  "'self'",
  "'unsafe-inline'",
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.google.com",
  "https://*.gstatic.com",
  "https://*.doubleclick.net",
  "https://*.adtrafficquality.google",
  "https://cdn.portone.io",
];

const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: `script-src ${SCRIPT_SOURCES.join(" ")}` },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Azure App Service: node .next/standalone/server.js (pnpm build:azure 가 static·public 을 복사)
  output: "standalone",
  // ADR-0015 phase 2: the browser's Supabase auth calls (/auth/v1/*) go to the GoTrue sidecar.
  // PostgREST (/rest/v1) is deliberately NOT rewritten — only the server reaches it on localhost.
  async rewrites() {
    const auth = process.env.SUPABASE_AUTH_INTERNAL_URL;
    return auth ? [{ source: "/auth/v1/:path*", destination: `${auth.replace(/\/$/, "")}/:path*` }] : [];
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
