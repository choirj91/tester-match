import { z } from "zod";

export const DEFAULT_IMPORT_SHORT_DESCRIPTION = "앱 테스트 참여자를 모집합니다.";

const playStoreUrl = z
  .string()
  .url({ message: "올바른 URL 형식이 아닙니다." })
  .refine((v) => /play\.google\.com/i.test(v), {
    message: "play.google.com 도메인이 포함된 링크여야 합니다.",
  });

export const AppImportRowSchema = z.object({
  email: z.string().email().max(254),
  nickname: z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    z.string().trim().min(1).max(32).optional(),
  ),
  app_name: z.string().trim().min(1).max(100),
  store_invite_url: z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    playStoreUrl.optional(),
  ),
  web_invite_url: z.preprocess(
    (v) => (v == null || (typeof v === "string" && v.trim() === "") ? undefined : v),
    playStoreUrl.optional(),
  ),
  required_testers: z.preprocess(
    (v) => (v == null || v === "" ? undefined : v),
    z.coerce.number().int().min(0).max(100).default(12),
  ),
  short_description: z.preprocess(
    (v) =>
      v == null || (typeof v === "string" && v.trim() === "")
        ? DEFAULT_IMPORT_SHORT_DESCRIPTION
        : v,
    z.string().trim().min(1),
  ),
  status: z.enum(["matching", "reviewing", "launched", "paused"]).default("matching"),
});

export const AppImportBatchSchema = z
  .array(AppImportRowSchema)
  .min(1, "최소 1건 이상 필요합니다.")
  .max(200, "한 번에 최대 200건까지 가능합니다.");

export type AppImportRow = z.infer<typeof AppImportRowSchema>;
export type AppImportBatch = z.infer<typeof AppImportBatchSchema>;
