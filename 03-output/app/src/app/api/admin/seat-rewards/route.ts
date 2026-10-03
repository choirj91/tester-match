import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getAdminUser } from "@/lib/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { forfeitSeatReward, releaseSeatReward } from "@/lib/seat-rewards";

export const runtime = "edge";

const ActionSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["release", "forfeit"]),
  admin_note: z.string().trim().max(300).default(""),
});

/** 관리자 판정: 이의 건 지급(release) 또는 몰수(forfeit). 보류 건 조기 지급도 release 로 가능. */
export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ ok: false, message: "권한이 없습니다." }, { status: 403 });
  }
  let payload;
  try {
    payload = ActionSchema.parse(await req.json());
  } catch (err) {
    const message =
      err instanceof ZodError ? (err.issues[0]?.message ?? "잘못된 요청") : "잘못된 요청";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const result =
    payload.action === "release"
      ? await releaseSeatReward(supabase, payload.id, "admin")
      : await forfeitSeatReward(supabase, payload.id, payload.admin_note);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 409 });
  }
  if (payload.action === "release" && payload.admin_note) {
    await supabase
      .from("seat_rewards")
      .update({ admin_note: payload.admin_note })
      .eq("id", payload.id);
  }
  return NextResponse.json({ ok: true });
}
