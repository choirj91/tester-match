import { describe, expect, test } from "vitest";
import { CompleteSignupSchema, SignupSchema, completeSignupErrorCode } from "./signup";

describe("SignupSchema", () => {
  test("이메일만 받고 정규화한다", () => {
    const parsed = SignupSchema.parse({ email: " Dev@Example.com " });
    expect(parsed.email).toBe("dev@example.com");
  });

  test("가입 단계에서는 비밀번호·닉네임을 받지 않는다 — 보내도 버린다", () => {
    const parsed = SignupSchema.parse({
      email: "dev@example.com",
      password: "password-1234",
      nickname: "누군가",
    });
    expect("password" in parsed).toBe(false);
    expect("nickname" in parsed).toBe(false);
  });

  test("이메일 형식이 아니면 거부한다", () => {
    expect(() => SignupSchema.parse({ email: "not-an-email" })).toThrow();
  });
});

const complete = {
  nickname: " 개발자 ",
  kakao_nickname: "오픈채팅닉",
  password: "password-1234",
  password_confirm: "password-1234",
  agreed: "on",
};

function codeOf(input: Record<string, unknown>) {
  const parsed = CompleteSignupSchema.safeParse(input);
  return parsed.success ? null : completeSignupErrorCode(parsed.error);
}

describe("CompleteSignupSchema", () => {
  test("정상 입력을 통과시키고 닉네임 앞뒤 공백을 지운다", () => {
    const parsed = CompleteSignupSchema.parse(complete);
    expect(parsed.nickname).toBe("개발자");
    expect(parsed.kakao_nickname).toBe("오픈채팅닉");
  });

  test("닉네임이 비었거나 32자를 넘으면 nickname", () => {
    expect(codeOf({ ...complete, nickname: "   " })).toBe("nickname");
    expect(codeOf({ ...complete, nickname: "가".repeat(33) })).toBe("nickname");
    expect(codeOf({ ...complete, nickname: null })).toBe("nickname");
  });

  test("카카오톡 닉네임이 비었거나 40자를 넘으면 kakao", () => {
    expect(codeOf({ ...complete, kakao_nickname: "" })).toBe("kakao");
    expect(codeOf({ ...complete, kakao_nickname: "가".repeat(41) })).toBe("kakao");
  });

  test("비밀번호가 8자 미만이거나 72자를 넘으면 weak", () => {
    expect(codeOf({ ...complete, password: "short", password_confirm: "short" })).toBe("weak");
    const long = "a".repeat(73);
    expect(codeOf({ ...complete, password: long, password_confirm: long })).toBe("weak");
  });

  test("글자 수가 아니라 바이트로 72를 넘으면 weak (한글 25자 = 75바이트)", () => {
    const korean = "가".repeat(25);
    expect(codeOf({ ...complete, password: korean, password_confirm: korean })).toBe("weak");
    const fits = "가".repeat(24);
    expect(codeOf({ ...complete, password: fits, password_confirm: fits })).toBe(null);
  });

  test("두 비밀번호가 다르면 mismatch", () => {
    expect(codeOf({ ...complete, password_confirm: "password-9999" })).toBe("mismatch");
  });

  test("약관에 동의하지 않으면 agree", () => {
    expect(codeOf({ ...complete, agreed: null })).toBe("agree");
    expect(codeOf({ ...complete, agreed: "off" })).toBe("agree");
  });

  test("양식 값이 문자열이 아니어도 예외 없이 거부한다", () => {
    expect(codeOf({ nickname: 1, kakao_nickname: {}, password: [], password_confirm: null })).toBe(
      "nickname",
    );
  });
});
