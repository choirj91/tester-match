import { describe, expect, test } from "vitest";
import { INQUIRY_DAILY_LIMIT, inquiryBacklogAlert, inquiryRateLimit } from "./inquiry-rules";

const NOW = new Date("2026-10-04T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000).toISOString();

describe("inquiryRateLimit", () => {
  test("최근 문의가 없으면 접수한다", () => {
    expect(inquiryRateLimit([], NOW)).toEqual({ ok: true });
  });

  test("1분 안에 다시 보내면 거절한다", () => {
    const result = inquiryRateLimit([minutesAgo(0.5)], NOW);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain("1분");
  });

  test("1분이 지나면 다시 접수한다", () => {
    expect(inquiryRateLimit([minutesAgo(1.01)], NOW)).toEqual({ ok: true });
  });

  test("24시간 안에 한도만큼 남겼으면 거절한다", () => {
    const recent = Array.from({ length: INQUIRY_DAILY_LIMIT }, (_, i) => minutesAgo(10 + i * 60));
    const result = inquiryRateLimit(recent, NOW);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain(`${INQUIRY_DAILY_LIMIT}건`);
  });

  test("24시간이 지난 문의는 한도에 세지 않는다", () => {
    const old = Array.from({ length: INQUIRY_DAILY_LIMIT }, (_, i) => minutesAgo(24 * 60 + 1 + i));
    expect(inquiryRateLimit(old, NOW)).toEqual({ ok: true });
  });

  test("한도보다 하나 적으면 접수한다", () => {
    const recent = Array.from({ length: INQUIRY_DAILY_LIMIT - 1 }, (_, i) => minutesAgo(10 + i * 60));
    expect(inquiryRateLimit(recent, NOW)).toEqual({ ok: true });
  });

  test("해석할 수 없는 시각은 무시한다", () => {
    expect(inquiryRateLimit(["not-a-date"], NOW)).toEqual({ ok: true });
  });
});

describe("inquiryBacklogAlert", () => {
  const daysAgo = (d: number) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  test("미답변 문의가 없으면 안내하지 않는다", () => {
    expect(inquiryBacklogAlert(0, null, NOW)).toBeNull();
  });

  test("건수와 가장 오래된 문의의 경과 일수를 알린다", () => {
    expect(inquiryBacklogAlert(3, daysAgo(2.5), NOW)).toBe(
      "미답변 문의 3건 — 가장 오래된 문의는 2일 전 접수 (/admin/inquiries).",
    );
  });

  test("하루가 안 된 문의는 일수 대신 하루 미만으로 적는다", () => {
    expect(inquiryBacklogAlert(1, minutesAgo(90), NOW)).toBe(
      "미답변 문의 1건 — 가장 오래된 문의는 접수한 지 하루 미만 (/admin/inquiries).",
    );
  });

  test("접수 시각을 모르면 건수만 알린다", () => {
    expect(inquiryBacklogAlert(2, null, NOW)).toBe("미답변 문의 2건 (/admin/inquiries).");
    expect(inquiryBacklogAlert(2, "not-a-date", NOW)).toBe("미답변 문의 2건 (/admin/inquiries).");
  });
});
