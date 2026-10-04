/**
 * 1:1 문의 — 서버 전용 (admin 클라이언트 사용).
 * inquiries 테이블은 RLS 정책이 없어 API 역할로는 읽고 쓸 수 없다. 권한 검사는 여기서 한다:
 * 작성자는 자기 문의만(운영용 열 제외), 관리자는 전부.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { inquiryAnsweredEmail } from "@/lib/email-templates";
import { INQUIRY_DAILY_LIMIT, INQUIRY_WINDOW_MS, inquiryRateLimit } from "@/lib/inquiry-rules";
import { createNotification } from "@/lib/notifications";
import { inquirySlackPayload, postSlackMessage } from "@/lib/slack";
import {
  INQUIRY_CATEGORIES,
  INQUIRY_STATUS_KEYS,
  type InquiryCategory,
  type InquiryCreateInput,
  type InquiryStatus,
} from "@/lib/validators/inquiry";

/** 작성자에게 보여주는 열 — 내부 메모·Slack 전송 여부·답변자 같은 운영용 열은 조회 자체를 하지 않는다 */
export type MemberInquiry = {
  id: number;
  user_id: number;
  category: InquiryCategory;
  title: string;
  body: string;
  status: InquiryStatus;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

export type AdminInquiry = MemberInquiry & {
  admin_memo: string | null;
  slack_notified_at: string | null;
  users: { nickname: string; email: string } | null;
};

const MEMBER_COLUMNS = "id, user_id, category, title, body, status, answer, answered_at, created_at";
const ADMIN_COLUMNS = `${MEMBER_COLUMNS}, admin_memo, slack_notified_at, users!inquiries_user_id_fkey(nickname, email)`;

/** DB 트리거(inquiries_rate_limit)가 내는 오류 메시지의 접두어 */
const RATE_LIMIT_ERROR_PREFIX = "INQUIRY_RATE_LIMIT";
const RATE_LIMIT_MESSAGE = "문의가 너무 자주 접수되었습니다. 잠시 후 다시 시도해주세요.";
const CREATE_FAILED_MESSAGE = "문의를 접수하지 못했습니다. 잠시 후 다시 시도해주세요.";

export type InquiryResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; status: number; message: string };

/** 조회 결과 — 조회 실패를 "없음"으로 보여주지 않기 위해 구분한다 */
export type Lookup<T> = { kind: "found"; row: T } | { kind: "missing" } | { kind: "error" };

/**
 * 문의 접수: 도배 방지 → 저장. 한도는 DB 트리거가 회원 단위 잠금 안에서 최종 판정하고(동시 요청 대비),
 * 여기의 사전 검사는 친절한 안내 문구를 위한 것이다.
 */
export async function createInquiry(
  supabase: SupabaseClient,
  author: { id: number },
  input: InquiryCreateInput,
): Promise<InquiryResult<{ id: number }>> {
  const now = new Date();
  const { data: recent, error: recentErr } = await supabase
    .from("inquiries")
    .select("created_at")
    .eq("user_id", author.id)
    .gte("created_at", new Date(now.getTime() - INQUIRY_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(INQUIRY_DAILY_LIMIT + 1);
  if (recentErr) {
    console.error("[inquiries] rate-limit lookup failed", recentErr);
    return { ok: false, status: 500, message: CREATE_FAILED_MESSAGE };
  }
  const limit = inquiryRateLimit(
    (recent ?? []).map((r) => r.created_at),
    now,
  );
  if (!limit.ok) return { ok: false, status: 429, message: limit.message };

  const { data: created, error } = await supabase
    .from("inquiries")
    .insert({
      user_id: author.id,
      category: input.category,
      title: input.title,
      body: input.body,
    })
    .select("id")
    .single();
  if (error?.message?.includes(RATE_LIMIT_ERROR_PREFIX)) {
    return { ok: false, status: 429, message: RATE_LIMIT_MESSAGE };
  }
  if (error || !created) {
    console.error("[inquiries] insert failed", error);
    return { ok: false, status: 500, message: CREATE_FAILED_MESSAGE };
  }
  return { ok: true, id: created.id };
}

/** 운영팀 Slack 에 새 문의를 알리고, 전송됐으면 시각을 기록한다. 실패해도 예외를 던지지 않는다. */
export async function announceInquiry(
  supabase: SupabaseClient,
  id: number,
  author: { id: number; nickname: string },
  input: InquiryCreateInput,
): Promise<boolean> {
  const slack = await postSlackMessage(
    process.env.SLACK_INQUIRY_WEBHOOK_URL,
    inquirySlackPayload({
      id,
      categoryLabel: INQUIRY_CATEGORIES[input.category],
      title: input.title,
      body: input.body,
      nickname: author.nickname,
      userId: author.id,
    }),
  );
  if (!slack.ok) return false;
  const { error } = await supabase
    .from("inquiries")
    .update({ slack_notified_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[inquiries] slack_notified_at update failed", id, error);
  return true;
}

export async function listOwnInquiries(
  supabase: SupabaseClient,
  userId: number,
): Promise<{ rows: MemberInquiry[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(MEMBER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) console.error("[inquiries] list failed", error);
  return { rows: (data ?? []) as MemberInquiry[], failed: error != null };
}

/** 작성자 본인의 문의만 — 남의 문의는 "없는 문의"와 구분되지 않는다 */
export async function getOwnInquiry(
  supabase: SupabaseClient,
  id: number,
  userId: number,
): Promise<Lookup<MemberInquiry>> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(MEMBER_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[inquiries] get failed", id, error);
    return { kind: "error" };
  }
  return data ? { kind: "found", row: data as MemberInquiry } : { kind: "missing" };
}

export async function getInquiryForAdmin(
  supabase: SupabaseClient,
  id: number,
): Promise<Lookup<AdminInquiry>> {
  const { data, error } = await supabase
    .from("inquiries")
    .select(ADMIN_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[inquiries] admin get failed", id, error);
    return { kind: "error" };
  }
  return data ? { kind: "found", row: data as unknown as AdminInquiry } : { kind: "missing" };
}

export async function listInquiriesForAdmin(
  supabase: SupabaseClient,
  status: InquiryStatus | null,
): Promise<{ rows: AdminInquiry[]; error: string | null }> {
  let query = supabase
    .from("inquiries")
    .select(ADMIN_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  return { rows: (data ?? []) as unknown as AdminInquiry[], error: error?.message ?? null };
}

/** 상태별 전체 건수 (목록의 200건 제한과 무관). 조회에 실패한 상태는 null */
export async function countInquiriesByStatus(
  supabase: SupabaseClient,
): Promise<Record<InquiryStatus, number | null>> {
  const counts = await Promise.all(
    INQUIRY_STATUS_KEYS.map(async (status) => {
      const { count, error } = await supabase
        .from("inquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", status);
      return [status, error ? null : (count ?? 0)] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<InquiryStatus, number | null>;
}

/**
 * 답변 등록 (다시 등록하면 답변을 고친다). 작성자에게 사이트 알림과 메일을 보낸다.
 * 메일 발송 결과를 돌려준다 — 관리자가 메일이 안 나간 것을 알 수 있게.
 */
export async function answerInquiry(
  supabase: SupabaseClient,
  adminId: number,
  id: number,
  answer: string,
): Promise<InquiryResult<{ emailSent: boolean }>> {
  const { data, error } = await supabase
    .from("inquiries")
    .update({
      answer,
      status: "answered",
      answered_by: adminId,
      answered_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, user_id, title, users!inquiries_user_id_fkey(nickname, email)")
    .maybeSingle();
  if (error) {
    console.error("[inquiries] answer failed", id, error);
    return { ok: false, status: 500, message: "답변을 저장하지 못했습니다." };
  }
  const row = data as unknown as {
    id: number;
    user_id: number;
    title: string;
    users: { nickname: string; email: string } | null;
  } | null;
  if (!row) return { ok: false, status: 404, message: "문의를 찾을 수 없습니다." };

  await createNotification({
    userId: row.user_id,
    type: "inquiry_answered",
    title: "문의에 답변이 등록되었습니다",
    body: `"${row.title.slice(0, 80)}" 문의의 답변을 확인해주세요.`,
    link: `/inquiries/${row.id}`,
  });
  if (!row.users?.email) return { ok: true, emailSent: false };
  const mail = inquiryAnsweredEmail({
    nickname: row.users.nickname,
    inquiryId: row.id,
    title: row.title,
    answer,
  });
  const sent = await sendEmail({ to: row.users.email, ...mail });
  return { ok: true, emailSent: sent.ok };
}

export async function setInquiryStatus(
  supabase: SupabaseClient,
  id: number,
  status: Exclude<InquiryStatus, "answered">,
): Promise<InquiryResult> {
  return updateInquiry(supabase, id, { status }, "상태를 바꾸지 못했습니다.");
}

export async function setInquiryMemo(
  supabase: SupabaseClient,
  id: number,
  memo: string,
): Promise<InquiryResult> {
  return updateInquiry(supabase, id, { admin_memo: memo || null }, "메모를 저장하지 못했습니다.");
}

async function updateInquiry(
  supabase: SupabaseClient,
  id: number,
  patch: Record<string, unknown>,
  failureMessage: string,
): Promise<InquiryResult> {
  const { data, error } = await supabase.from("inquiries").update(patch).eq("id", id).select("id");
  if (error) {
    console.error("[inquiries] update failed", id, error);
    return { ok: false, status: 500, message: failureMessage };
  }
  if (!data || data.length === 0) return { ok: false, status: 404, message: "문의를 찾을 수 없습니다." };
  return { ok: true };
}
