import { z } from "zod";

const playStoreUrl = z
  .string()
  .url({ message: "올바른 URL 형식이 아닙니다." })
  .refine((v) => /play\.google\.com/i.test(v), {
    message: "play.google.com 도메인이 포함된 링크여야 합니다.",
  });

/** 빈 문자열은 undefined 로 변환 (선택 필드 처리) */
const optionalUrl = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().url({ message: "올바른 URL 형식이 아닙니다." }).optional(),
);

export const AppCreateSchema = z.object({
  nickname: z
    .string()
    .trim()
    .min(1, "닉네임을 입력해주세요.")
    .max(32, "닉네임은 32자 이하로 입력해주세요."),
  name: z
    .string()
    .trim()
    .min(1, "앱 이름을 입력해주세요.")
    .max(100, "앱 이름은 100자 이하로 입력해주세요."),
  store_invite_url: playStoreUrl,
  web_invite_url: playStoreUrl,
  google_group_url: optionalUrl,
  required_testers: z.coerce
    .number()
    .int({ message: "정수만 입력해주세요." })
    .min(0, "0명 이상이어야 합니다.")
    .max(100, "100명 이하로 입력해주세요."),
  short_description: z
    .string()
    .trim()
    .min(1, "앱 설명을 입력해주세요."),
});

export type AppCreateInput = z.infer<typeof AppCreateSchema>;

export const AppUpdateSchema = AppCreateSchema.partial().extend({
  status: z.enum(["matching", "reviewing", "launched", "paused"]).optional(),
});

export type AppUpdateInput = z.infer<typeof AppUpdateSchema>;
