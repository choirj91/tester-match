import { z } from "zod";

export const ProfileUpdateSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력해주세요.")
    .max(32, "닉네임은 32자 이하로 입력해주세요."),
  /** 카카오톡 오픈채팅 닉네임 — 선택. 빈 문자열은 삭제(null)로 처리한다. */
  kakao_nickname: z
    .string()
    .trim()
    .max(40, "카카오톡 닉네임은 40자 이하로 입력해주세요.")
    .optional(),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
