import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppImportBatchSchema, type AppImportRow } from "@/lib/validators/admin-app-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminUser } from "@/lib/admin";

export const runtime = "edge";

type ImportError = { row: number; email?: string; reason: string };

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "관리자 권한 필요" }, { status: 403 });
  }

  let rows: AppImportRow[];
  try {
    rows = AppImportBatchSchema.parse(await req.json());
  } catch (err) {
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const path = issue?.path.join(".") ?? "?";
      return NextResponse.json(
        { ok: false, message: `검증 실패 (${path}): ${issue?.message}` },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: false, message: "잘못된 JSON" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const errors: ImportError[] = [];
  let imported = 0;
  let placeholdersCreated = 0;

  // 같은 batch 안에서 동일 이메일 사용자 캐시 (중복 lookup 회피)
  const userIdByEmail = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      // 1) 사용자 확보 — 캐시 → DB 조회 → 없으면 placeholder 생성
      let userId: number;
      const cached = userIdByEmail.get(row.email);
      if (cached != null) {
        userId = cached;
      } else {
        const { data: existing } = await supabase
          .from("users")
          .select("id")
          .eq("email", row.email)
          .maybeSingle();

        if (existing) {
          userId = existing.id;
        } else {
          const nickname = row.nickname ?? row.email.split("@")[0];
          const { data: created, error: insErr } = await supabase
            .from("users")
            .insert({
              email: row.email,
              nickname,
              // auth_user_id, google_id NULL → 미인증 placeholder
              // terms/privacy_agreed_at default = now() (admin-time)
              // 실제 OAuth 시 트리거가 auth_user_id 채워주며 자동 매칭
            })
            .select("id")
            .single();
          if (insErr || !created) {
            errors.push({
              row: i + 1,
              email: row.email,
              reason: `user_create_failed: ${insErr?.message ?? "unknown"}`,
            });
            continue;
          }
          userId = created.id;
          placeholdersCreated++;
        }
        userIdByEmail.set(row.email, userId);
      }

      // 2) 앱 INSERT
      const { error: appErr } = await supabase.from("apps").insert({
        owner_user_id: userId,
        name: row.app_name,
        store_invite_url: row.store_invite_url,
        web_invite_url: row.web_invite_url,
        required_testers: row.required_testers,
        short_description: row.short_description,
        status: row.status,
      });
      if (appErr) {
        errors.push({
          row: i + 1,
          email: row.email,
          reason: `app_insert_failed: ${appErr.message}`,
        });
        continue;
      }
      imported++;
    } catch (e) {
      errors.push({
        row: i + 1,
        email: row.email,
        reason: `exception: ${String(e)}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped: errors.length,
    total: rows.length,
    placeholders_created: placeholdersCreated,
    errors,
  });
}
