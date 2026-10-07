import { describe, expect, test } from "vitest";
import { paidOrderReceiptEmail } from "./email-templates";

const base = {
  buyerNickname: "개발자",
  appName: "가계부",
  testerCount: 14,
  amountKrw: 15400,
  orderCode: "pt_0123456789abcdef0123456789abcdef",
};

describe("paidOrderReceiptEmail", () => {
  test("says the boost and member notice went out when seats were opened", () => {
    const mail = paidOrderReceiptEmail({ ...base, seatsOpened: true });
    expect(mail.html).toContain("급구 노출과 전 회원 알림이 나갔고");
  });

  test("does not claim a boost for review orders whose seats stay closed", () => {
    const mail = paidOrderReceiptEmail({ ...base, seatsOpened: false });
    expect(mail.html).not.toContain("급구 노출");
    expect(mail.html).toContain("시트를 열지 않았습니다");
    expect(mail.html).not.toContain("7일 내 채워지지 않은 시트는 자동 환불");
  });
});
