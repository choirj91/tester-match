import { describe, expect, test } from "vitest";
import { InquiryAdminActionSchema, InquiryCreateSchema } from "./inquiry";

describe("InquiryCreateSchema", () => {
  const valid = { category: "paid", title: "결제 문의", body: "결제가 두 번 된 것 같습니다." };

  test("정상 입력을 통과시키고 앞뒤 공백을 지운다", () => {
    const parsed = InquiryCreateSchema.parse({ ...valid, title: "  결제 문의  " });
    expect(parsed.title).toBe("결제 문의");
  });

  test("목록에 없는 분류는 거절한다", () => {
    expect(InquiryCreateSchema.safeParse({ ...valid, category: "질문" }).success).toBe(false);
  });

  test("본문이 10자 미만이면 거절한다", () => {
    const result = InquiryCreateSchema.safeParse({ ...valid, body: "짧아요" });
    expect(result.success).toBe(false);
  });

  test("NUL 문자가 든 제목·본문을 거절한다", () => {
    expect(InquiryCreateSchema.safeParse({ ...valid, title: "결제\u0000문의" }).success).toBe(false);
    expect(InquiryCreateSchema.safeParse({ ...valid, body: `결제가 두 번 됐습니다\u0000 확인 부탁` }).success).toBe(false);
  });

  test("본문 5,000자 초과와 제목 120자 초과를 거절한다", () => {
    expect(InquiryCreateSchema.safeParse({ ...valid, body: "가".repeat(5001) }).success).toBe(false);
    expect(InquiryCreateSchema.safeParse({ ...valid, title: "가".repeat(121) }).success).toBe(false);
  });
});

describe("InquiryAdminActionSchema", () => {
  test("답변은 내용이 있어야 한다", () => {
    expect(InquiryAdminActionSchema.safeParse({ id: 1, action: "answer", answer: "  " }).success).toBe(false);
    expect(InquiryAdminActionSchema.safeParse({ id: 1, action: "answer", answer: "확인했습니다." }).success).toBe(true);
  });

  test("상태 변경으로는 '답변 완료'를 만들 수 없다", () => {
    expect(InquiryAdminActionSchema.safeParse({ id: 1, action: "status", status: "answered" }).success).toBe(false);
    expect(InquiryAdminActionSchema.safeParse({ id: 1, action: "status", status: "closed" }).success).toBe(true);
  });

  test("메모는 빈 값으로 지울 수 있다", () => {
    expect(InquiryAdminActionSchema.safeParse({ id: "3", action: "memo", memo: "" }).success).toBe(true);
  });

  test("모르는 동작은 거절한다", () => {
    expect(InquiryAdminActionSchema.safeParse({ id: 1, action: "delete" }).success).toBe(false);
  });
});
