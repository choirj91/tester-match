import { z } from "zod";

export const ProfileUpdateSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력해주세요.")
    .max(32, "닉네임은 32자 이하로 입력해주세요."),
});

export type ProfileUpdateInput = z.infer<typeof ProfileUpdateSchema>;
