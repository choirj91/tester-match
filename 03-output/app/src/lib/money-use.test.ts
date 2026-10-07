import { describe, expect, test } from "vitest";
import { CARD_FEE_RATE, MONEY_USE, splitMoneyUse } from "./money-use";

describe("splitMoneyUse", () => {
  test("splits 1,100 won into reward, VAT, card fee and what is left for servers and operations", () => {
    const m = splitMoneyUse(1100, 700);
    expect(m.reward).toBe(700);
    expect(m.vat).toBe(100);
    expect(m.cardFee).toBe(40);
    expect(m.operating).toBe(260);
    expect(m.reward + m.vat + m.cardFee + m.operating).toBe(m.price);
  });

  test("VAT is the 10% already inside a VAT-included price", () => {
    expect(splitMoneyUse(2200, 700).vat).toBe(200);
  });

  test("card fee includes VAT on the fee and is rounded to 10 won", () => {
    const fee = splitMoneyUse(1100, 700).cardFee;
    expect(fee % 10).toBe(0);
    expect(Math.abs(fee - 1100 * CARD_FEE_RATE * 1.1)).toBeLessThan(5);
  });

  test("never reports a negative operating share", () => {
    expect(splitMoneyUse(1100, 1100).operating).toBe(0);
  });

  test("the site-wide numbers come from the price and reward constants", () => {
    expect(MONEY_USE.price).toBe(1100);
    expect(MONEY_USE.reward).toBe(700);
    expect(MONEY_USE.operating).toBe(260);
  });
});
