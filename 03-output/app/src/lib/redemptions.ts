/**
 * 보상 교환 신청·거절 DB 함수의 결과 해석 (ADR-0020).
 * 함수 정의: supabase/migrations/20261008000002_redemption_atomic.sql
 *   redemption_create → 'ok:<id>' | 'invalid' | 'pending' | 'not_redeemable' | 'contact_in_use'
 *   redemption_reject → 'rejected' | 'already'
 */

export const REDEMPTION_CREATE_ERRORS = ["invalid", "pending", "not_redeemable", "contact_in_use"] as const;
export type RedemptionCreateError = (typeof REDEMPTION_CREATE_ERRORS)[number];

export type RedemptionCreateResult =
  | { kind: "ok"; id: number }
  | { kind: "error"; code: RedemptionCreateError }
  | { kind: "unknown" };

export function parseRedemptionCreateResult(raw: unknown): RedemptionCreateResult {
  if (typeof raw !== "string") return { kind: "unknown" };
  const ok = /^ok:(\d+)$/.exec(raw);
  if (ok) return { kind: "ok", id: Number(ok[1]) };
  if ((REDEMPTION_CREATE_ERRORS as readonly string[]).includes(raw)) {
    return { kind: "error", code: raw as RedemptionCreateError };
  }
  return { kind: "unknown" };
}

export type ApiFailure = { status: number; message: string };

const NOT_REDEEMABLE: ApiFailure = {
  status: 409,
  message: "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)",
};
const PENDING: ApiFailure = { status: 409, message: "이미 처리 대기 중인 교환 신청이 있습니다." };
const FAILED: ApiFailure = { status: 500, message: "신청에 실패했습니다." };

/** 회원에게 보이는 문구 — 함수로 옮기기 전 라우트와 같은 말 */
export const REDEMPTION_CREATE_ERROR_RESPONSE: Readonly<Record<RedemptionCreateError, ApiFailure>> = {
  invalid: { status: 400, message: "신청 내용을 다시 확인해주세요." },
  pending: PENDING,
  not_redeemable: NOT_REDEEMABLE,
  contact_in_use: {
    status: 409,
    message: "다른 계정에서 이미 사용된 연락처입니다. 문의가 필요하면 운영팀에 메일 주세요.",
  },
};

export type DbError = { code?: string | null; message?: string | null };

/**
 * RPC 호출 자체가 실패한 경우. 함수 안에서 ledger_append 가 잔액을 다시 확인하다 낸 예외와
 * 동시 신청의 대기 1건 unique 위반은 회원 문구로, 나머지는 500 (아무것도 기록되지 않는다 — 한 트랜잭션).
 */
export function redemptionRpcFailure(error: DbError): ApiFailure {
  const message = error.message ?? "";
  if (message.includes("NOT_REDEEMABLE") || message.includes("INSUFFICIENT")) return NOT_REDEEMABLE;
  if (error.code === "23505") return PENDING;
  return FAILED;
}

export type RedemptionRejectResult = "rejected" | "already" | "unknown";

export function parseRedemptionRejectResult(raw: unknown): RedemptionRejectResult {
  return raw === "rejected" || raw === "already" ? raw : "unknown";
}

/** 처리가 끝난 신청의 연락처는 뒤 4자리만 남긴다 — redemption_reject 의 SQL 식과 같다 */
export function maskContact(contact: string): string {
  return contact.length > 4 ? `${"*".repeat(contact.length - 4)}${contact.slice(-4)}` : contact;
}

/** 로그에는 오류 코드·문구만 남긴다 (PostgREST 오류 객체 전체를 남기지 않는다) */
export function dbErrorLog(error: DbError): { code: string | null; message: string | null } {
  return { code: error.code ?? null, message: error.message ?? null };
}
