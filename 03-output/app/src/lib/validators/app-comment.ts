import { z } from "zod";

export const AppCommentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "댓글을 입력해주세요.")
    .max(1000, "댓글은 1,000자 이하로 입력해주세요."),
  promoted_app_id: z.coerce.number().int().positive().nullable().optional(),
});

export const AppCommentUpdateSchema = AppCommentCreateSchema.pick({ body: true });

export type AppCommentCreateInput = z.infer<typeof AppCommentCreateSchema>;
