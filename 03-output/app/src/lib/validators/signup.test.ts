import { describe, expect, test } from "vitest";
import { SignupSchema } from "./signup";

const valid = {
  email: " Dev@Example.com ",
  password: "password-1234",
  nickname: "개발자",
  kakao_nickname: "오픈채팅닉",
  agreed: true,
};

describe("SignupSchema", () => {
  test("정상 입력을 통과시키고 이메일을 정규화한다", () => {
    const parsed = SignupSchema.parse(valid);
    expect(parsed.email).toBe("dev@example.com");
    expect(parsed.kakao_nickname).toBe("오픈채팅닉");
  });

  test("카카오톡 닉네임이 없으면 거부한다", () => {
    expect(() => SignupSchema.parse({ ...valid, kakao_nickname: "  " })).toThrow();
  });

  test("8자 미만 비밀번호는 거부한다", () => {
    expect(() => SignupSchema.parse({ ...valid, password: "short" })).toThrow();
  });

  test("약관 미동의는 거부한다", () => {
    expect(() => SignupSchema.parse({ ...valid, agreed: false })).toThrow();
  });

  test("이메일 형식이 아니면 거부한다", () => {
    expect(() => SignupSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });
});
