import { describe, expect, test } from "vitest";
import { INQUIRY_DAILY_LIMIT, inquiryRateLimit } from "./inquiry-rules";

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
