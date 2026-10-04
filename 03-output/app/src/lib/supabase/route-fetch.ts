/**
 * Server-only fetch for the Supabase SDK when Supabase's services are self-hosted next to the app
 * (ADR-0015 phase 2: PostgREST and GoTrue as App Service sidecars on Azure PostgreSQL).
 *
 * The SDK builds URLs as `${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/...` and `/auth/v1/...`. We keep that
 * public URL (it also names the session cookie) and only rewrite where the request goes:
 *   /rest/v1/* → SUPABASE_REST_INTERNAL_URL  (PostgREST, never exposed publicly)
 *   /auth/v1/* → SUPABASE_AUTH_INTERNAL_URL  (GoTrue)
 * Without those variables nothing changes and the SDK talks to Supabase cloud.
 */
type FetchInput = string | URL | Request;

function rewrite(href: string, rest: string | undefined, auth: string | undefined): string | null {
  const url = new URL(href);
  if (rest && url.pathname.startsWith("/rest/v1")) {
    return rest.replace(/\/$/, "") + url.pathname.slice("/rest/v1".length) + url.search;
  }
  if (auth && url.pathname.startsWith("/auth/v1")) {
    return auth.replace(/\/$/, "") + url.pathname.slice("/auth/v1".length) + url.search;
  }
  return null;
}

export function supabaseServerFetch(
  env: { rest?: string; auth?: string } = {
    rest: process.env.SUPABASE_REST_INTERNAL_URL,
    auth: process.env.SUPABASE_AUTH_INTERNAL_URL,
  },
  baseFetch: typeof fetch = fetch,
): typeof fetch | undefined {
  if (!env.rest && !env.auth) return undefined;
  return ((input: FetchInput, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const target = rewrite(href, env.rest, env.auth);
    if (!target) return baseFetch(input, init);
    if (input instanceof Request) return baseFetch(new Request(target, input), init);
    return baseFetch(target, init);
  }) as typeof fetch;
}

/** `global.fetch` option for createClient/createServerClient — empty when not self-hosted. */
export function supabaseGlobalOptions(): { global?: { fetch: typeof fetch } } {
  const f = supabaseServerFetch();
  return f ? { global: { fetch: f } } : {};
}
