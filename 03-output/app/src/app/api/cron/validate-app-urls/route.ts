import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyCronAuth } from "@/lib/cron-auth";

export const runtime = "edge";

/**
 * F-APP-02 — 앱 초대 링크 HEAD 검증.
 *
 * 대상: status in ('matching','reviewing','launched') 이면서
 *       store_invite_url_validated_at 이 NULL 이거나 24h 보다 오래된 앱.
 *
 * 동작:
 *   - store_invite_url 과 web_invite_url 각각 HEAD (redirect manual)
 *   - 둘 다 200/302 면 store_invite_url_validated_at = now() 갱신
 *   - 어느 하나라도 실패면 해당 시각 갱신 안 함 + 콘솔 로그
 *
 * Cloudflare Cron 권장: 6시간 마다.
 *   crons += ["0 *\/6 * * *"]
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: apps, error } = await supabase
    .from("apps")
    .select("id, name, store_invite_url, web_invite_url, store_invite_url_validated_at")
    .in("status", ["matching", "reviewing", "launched"])
    .or(
      `store_invite_url_validated_at.is.null,store_invite_url_validated_at.lt.${cutoff}`,
    )
    .limit(50);

  if (error) {
    console.error("[cron/validate-app-urls] query failed", error);
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let valid = 0;
  let invalid = 0;
  const issues: Array<{ id: number; name: string; reason: string }> = [];

  for (const app of apps ?? []) {
    const result = await validatePair(app.store_invite_url, app.web_invite_url);
    if (result.ok) {
      await supabase
        .from("apps")
        .update({ store_invite_url_validated_at: new Date().toISOString() })
        .eq("id", app.id);
      valid++;
    } else {
      invalid++;
      issues.push({ id: app.id, name: app.name, reason: result.reason });
      console.warn("[validate-app-urls] invalid", app.id, app.name, result.reason);
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: apps?.length ?? 0,
    valid,
    invalid,
    issues,
  });
}

async function validatePair(
  storeUrl: string | null,
  webUrl: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!storeUrl || !webUrl) return { ok: false, reason: "missing_url" };
  const [a, b] = await Promise.all([head(storeUrl), head(webUrl)]);
  if (!a.ok) return { ok: false, reason: `android_${a.reason}` };
  if (!b.ok) return { ok: false, reason: `web_${b.reason}` };
  return { ok: true };
}

async function head(
  url: string,
): Promise<{ ok: true; status: number } | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; TesterMatchBot/1.0; +https://testermatch.com/bot)",
      },
    });
    if (res.status >= 200 && res.status < 400) return { ok: true, status: res.status };
    return { ok: false, reason: `http_${res.status}` };
  } catch {
    return { ok: false, reason: "exception" };
  }
}

export const POST = GET;
