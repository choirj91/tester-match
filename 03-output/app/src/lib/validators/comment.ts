import { z } from "zod";

export const CommentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "댓글을 입력해주세요.")
    .max(2000, "댓글은 2,000자 이하로 입력해주세요."),
});

export const CommentUpdateSchema = CommentCreateSchema;

export type CommentCreateInput = z.infer<typeof CommentCreateSchema>;
