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
  it("covers the written ledger types", () => {
    expect(CREDIT_TYPE_LABEL.earn).toBe("적립");
    expect(CREDIT_TYPE_LABEL.spend).toBe("사용");
    expect(CREDIT_TYPE_LABEL.refund).toBe("복구");
    expect(CREDIT_TYPE_LABEL.penalty).toBe("페널티");
  });

  it("has no purchase-style labels (ADR-0017 wording)", () => {
    expect(CREDIT_TYPE_LABEL.charge).toBeUndefined();
    const labels = Object.values(CREDIT_TYPE_LABEL).join(" ");
    for (const word of ["충전", "환불", "환급", "구매", "현금"]) expect(labels).not.toContain(word);
  });
});
