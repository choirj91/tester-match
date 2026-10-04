import type { NextConfig } from "next";

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
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
