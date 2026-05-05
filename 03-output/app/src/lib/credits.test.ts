import { describe, expect, it } from "vitest";
import { CREDIT_TYPE_LABEL, formatKrw } from "./credits";

describe("formatKrw", () => {
  it("formats with thousand separator", () => {
    expect(formatKrw(0)).toBe("0");
    expect(formatKrw(800)).toBe("800");
    expect(formatKrw(1000)).toBe("1,000");
    expect(formatKrw(1234567)).toBe("1,234,567");
  });

  it("handles negative", () => {
    expect(formatKrw(-1000)).toBe("-1,000");
  });
});

describe("CREDIT_TYPE_LABEL", () => {
  it("covers all enum values", () => {
    expect(CREDIT_TYPE_LABEL.earn).toBe("적립");
    expect(CREDIT_TYPE_LABEL.charge).toBe("충전");
    expect(CREDIT_TYPE_LABEL.spend).toBe("사용");
    expect(CREDIT_TYPE_LABEL.refund).toBe("환불");
    expect(CREDIT_TYPE_LABEL.penalty).toBe("페널티");
  });
});
