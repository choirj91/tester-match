import { z } from "zod";

export const MatchOptInSchema = z.object({
  app_id: z.coerce.number().int().positive(),
});

export const MatchOptOutSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "사유를 입력해주세요.")
    .max(500, "사유는 500자 이하로 입력해주세요.")
    .optional(),
});

export type MatchOptInInput = z.infer<typeof MatchOptInSchema>;
export type MatchOptOutInput = z.infer<typeof MatchOptOutSchema>;
