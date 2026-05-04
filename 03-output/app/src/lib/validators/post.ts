import { z } from "zod";

export const POST_CATEGORIES = ["자유", "질문", "공유", "구인"] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export const PostCreateSchema = z.object({
  category: z.enum(POST_CATEGORIES),
  title: z
    .string()
    .trim()
    .min(1, "제목을 입력해주세요.")
    .max(120, "제목은 120자 이하로 입력해주세요."),
  body: z
    .string()
    .trim()
    .min(1, "본문을 입력해주세요.")
    .max(10000, "본문은 10,000자 이하로 입력해주세요."),
});

export const PostUpdateSchema = PostCreateSchema.partial();

export type PostCreateInput = z.infer<typeof PostCreateSchema>;
export type PostUpdateInput = z.infer<typeof PostUpdateSchema>;
