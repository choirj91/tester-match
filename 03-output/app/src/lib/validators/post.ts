import { z } from "zod";

/** 일반 사용자가 선택 가능한 카테고리 */
export const POST_CATEGORIES = ["자유", "질문", "공유", "구인"] as const;
/** 관리자 전용 카테고리 — API 에서 role 검증 */
export const NOTICE_CATEGORY = "공지" as const;
/** 필터·검증용 전체 카테고리 */
export const ALL_POST_CATEGORIES = [NOTICE_CATEGORY, ...POST_CATEGORIES] as const;
export type PostCategory = (typeof ALL_POST_CATEGORIES)[number];

export const PostCreateSchema = z.object({
  category: z.enum(ALL_POST_CATEGORIES),
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
