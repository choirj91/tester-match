import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  REDEMPTION_CREATE_ERRORS,
  REDEMPTION_CREATE_ERROR_RESPONSE,
  dbErrorLog,
  maskContact,
  parseRedemptionCreateResult,
  parseRedemptionRejectResult,
  redemptionRpcFailure,
} from "./redemptions";
import { REDEMPTION_MAX_CREDITS, REDEMPTION_MAX_QUANTITY } from "./rewards";

const SQL = readFileSync(
  path.resolve(__dirname, "../../../supabase/migrations/20261008000002_redemption_atomic.sql"),
  "utf8",
);

describe("parseRedemptionCreateResult", () => {
  test("ok:<id> → 신청 id", () => {
    expect(parseRedemptionCreateResult("ok:42")).toEqual({ kind: "ok", id: 42 });
  });

  test.each(REDEMPTION_CREATE_ERRORS)("%s → 오류 코드", (code) => {
    expect(parseRedemptionCreateResult(code)).toEqual({ kind: "error", code });
  });

  test.each([null, undefined, 42, "ok:", "ok:abc", "granted", ["ok:1"]])("%j → unknown", (raw) => {
    expect(parseRedemptionCreateResult(raw)).toEqual({ kind: "unknown" });
  });
});

describe("오류 코드 → 회원 문구", () => {
  test("모든 코드에 응답이 있다 (함수로 옮기기 전과 같은 문구)", () => {
    expect(REDEMPTION_CREATE_ERROR_RESPONSE.pending).toEqual({
      status: 409,
      message: "이미 처리 대기 중인 교환 신청이 있습니다.",
    });
    expect(REDEMPTION_CREATE_ERROR_RESPONSE.not_redeemable).toEqual({
      status: 409,
      message: "교환 가능 크레딧이 부족합니다. (유료 시트 완주 적립분만 교환됩니다)",
    });
    expect(REDEMPTION_CREATE_ERROR_RESPONSE.contact_in_use).toEqual({
      status: 409,
      message: "다른 계정에서 이미 사용된 연락처입니다. 문의가 필요하면 운영팀에 메일 주세요.",
    });
    expect(REDEMPTION_CREATE_ERROR_RESPONSE.invalid.status).toBe(400);
  });

  test("RPC 예외: 잔액 재검사 실패는 교환 가능액 부족, unique 위반은 대기 1건, 나머지는 500", () => {
    expect(redemptionRpcFailure({ code: "P0001", message: "NOT_REDEEMABLE" })).toBe(
      REDEMPTION_CREATE_ERROR_RESPONSE.not_redeemable,
    );
    expect(redemptionRpcFailure({ code: "P0001", message: "INSUFFICIENT" })).toBe(
      REDEMPTION_CREATE_ERROR_RESPONSE.not_redeemable,
    );
    expect(redemptionRpcFailure({ code: "23505", message: "duplicate key" })).toBe(REDEMPTION_CREATE_ERROR_RESPONSE.pending);
    expect(redemptionRpcFailure({ code: "57014", message: "timeout" })).toEqual({
      status: 500,
      message: "신청에 실패했습니다.",
    });
  });
});

describe("parseRedemptionRejectResult", () => {
  test.each([
    ["rejected", "rejected"],
    ["already", "already"],
    ["ok", "unknown"],
    [null, "unknown"],
  ])("%j → %s", (raw, expected) => {
    expect(parseRedemptionRejectResult(raw)).toBe(expected);
  });
});

describe("maskContact", () => {
  test("뒤 4자리만 남긴다", () => {
    expect(maskContact("01012345678")).toBe("*******5678");
    expect(maskContact("1234")).toBe("1234");
  });
});

describe("dbErrorLog", () => {
  test("코드와 문구만 남긴다", () => {
    const error = { code: "23505", message: "dup", details: "Key (contact)=(010...)", hint: null };
    expect(dbErrorLog(error)).toEqual({ code: "23505", message: "dup" });
  });
});

describe("앱 상수·코드 = DB 함수", () => {
  test("돌려주는 오류 코드가 SQL 에 모두 있다", () => {
    for (const code of REDEMPTION_CREATE_ERRORS) expect(SQL).toContain(`return '${code}';`);
    expect(SQL).toContain("return 'ok:' || v_id;");
    expect(SQL).toContain("return 'rejected';");
    expect(SQL).toContain("return 'already';");
  });

  test("1회 상한·수량 상한이 같다", () => {
    expect(SQL).toContain(`c_max_credits constant integer := ${REDEMPTION_MAX_CREDITS};`);
    expect(SQL).toContain(`c_max_quantity constant integer := ${REDEMPTION_MAX_QUANTITY};`);
    expect(SQL).toContain(`check (amount <= ${REDEMPTION_MAX_CREDITS})`);
  });

  test("마스킹 식이 같다 (뒤 4자리)", () => {
    expect(SQL).toContain("repeat('*', length(contact) - 4) || right(contact, 4)");
  });

  test("API 역할에는 열지 않는다", () => {
    expect(SQL).toMatch(/revoke all on function public\.redemption_create\([^)]*\)\s+from public, anon, authenticated;/);
    expect(SQL).toMatch(/revoke all on function public\.redemption_reject\([^)]*\) from public, anon, authenticated;/);
  });
});
