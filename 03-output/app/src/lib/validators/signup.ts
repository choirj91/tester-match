import { z } from "zod";

export const KAKAO_NICKNAME_MAX = 40;

export const SignupSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일 주소를 입력해주세요.").max(254),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .max(72, "비밀번호는 72자 이하여야 합니다."),
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력해주세요.")
    .max(32, "닉네임은 32자 이하로 입력해주세요."),
  kakao_nickname: z
    .string()
    .trim()
    .min(1, "카카오톡 닉네임을 입력해주세요.")
    .max(KAKAO_NICKNAME_MAX, `카카오톡 닉네임은 ${KAKAO_NICKNAME_MAX}자 이하로 입력해주세요.`),
  agreed: z.boolean().refine((v) => v === true, "이용약관과 개인정보처리방침에 동의해주세요."),
  /** 허니팟 — 사람에게 보이지 않는 칸. 값이 있으면 봇으로 본다. */
  website: z.string().max(200).optional(),
});

export type SignupInput = z.infer<typeof SignupSchema>;

/** 이메일 가입 노출 여부 — 인증 메일 발신 도메인이 준비되기 전에는 닫아둔다 (빌드 시 주입). */
export function isEmailSignupEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_SIGNUP_ENABLED === "1";
}
