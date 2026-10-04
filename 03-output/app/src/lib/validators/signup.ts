import { z } from "zod";

export const NICKNAME_MAX = 32;
export const KAKAO_NICKNAME_MAX = 40;
export const PASSWORD_MIN = 8;
/** bcrypt 가 실제로 쓰는 길이 상한 — 글자 수가 아니라 바이트다 (한글은 글자당 3바이트) */
export const PASSWORD_MAX = 72;

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

/**
 * 가입 1단계 — 이메일만 받는다 (ADR-0013 보강).
 * 닉네임·비밀번호·약관 동의는 메일의 링크를 연 사람이 2단계(확인 화면)에서 직접 입력한다.
 * 1단계에서 받으면 남의 주소를 넣은 사람이 정한 값이 그 주소 주인의 계정에 들어간다.
 */
export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일 주소를 입력해주세요.").max(254),
  /** 허니팟 — 사람에게 보이지 않는 칸. 값이 있으면 봇으로 본다. */
  website: z.string().max(200).optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;

/** 양식 값은 문자열이 아닐 수 있다(없음·파일) — 빈 문자열로 바꿔 같은 규칙으로 거른다 */
const formText = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * 가입 2단계 — 확인 화면 양식. 오류 메시지는 화면 문구가 아니라 코드다.
 */
export const CompleteSignupSchema = z
  .object({
    nickname: z.preprocess(
      formText,
      z.string().trim().min(1, "nickname").max(NICKNAME_MAX, "nickname"),
    ),
    kakao_nickname: z.preprocess(
      formText,
      z.string().trim().min(1, "kakao").max(KAKAO_NICKNAME_MAX, "kakao"),
    ),
    password: z.preprocess(
      formText,
      z
        .string()
        .min(PASSWORD_MIN, "weak")
        .refine((v) => utf8Length(v) <= PASSWORD_MAX, "weak"),
    ),
    password_confirm: z.preprocess(formText, z.string()),
    /** 체크박스 — 체크하면 "on" 이 온다 */
    agreed: z.preprocess(
      formText,
      z.string().refine((v) => v === "on", "agree"),
    ),
  })
  .refine((v) => v.password === v.password_confirm, { message: "mismatch" });

export type CompleteSignupInput = z.infer<typeof CompleteSignupSchema>;

export type CompleteSignupError = "nickname" | "kakao" | "weak" | "mismatch" | "agree";

const COMPLETE_SIGNUP_ERRORS: readonly string[] = ["nickname", "kakao", "weak", "mismatch", "agree"];

/** 첫 번째 오류를 코드로 바꾼다 — 알 수 없는 오류는 weak 로 본다 */
export function completeSignupErrorCode(error: z.ZodError): CompleteSignupError {
  const message = error.issues[0]?.message ?? "";
  return COMPLETE_SIGNUP_ERRORS.includes(message) ? (message as CompleteSignupError) : "weak";
}

/** 이메일 가입 노출 여부 — 인증 메일 발신 도메인이 준비되기 전에는 닫아둔다 (빌드 시 주입). */
export function isEmailSignupEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_SIGNUP_ENABLED === "1";
}
