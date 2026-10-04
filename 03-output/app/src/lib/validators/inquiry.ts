import { z } from "zod";

/** 1:1 문의 분류 — DB CHECK(inquiries.category) 와 같은 키 */
export const INQUIRY_CATEGORIES = {
  account: "계정·로그인",
  matching: "매칭·테스트 참여",
  paid: "유료 테스터·결제",
  credits: "크레딧·기프티콘",
  report: "신고·제보",
  other: "기타",
} as const;
export type InquiryCategory = keyof typeof INQUIRY_CATEGORIES;
export const INQUIRY_CATEGORY_KEYS = Object.keys(INQUIRY_CATEGORIES) as [
  InquiryCategory,
  ...InquiryCategory[],
];

/** 처리 상태 — DB CHECK(inquiries.status) 와 같은 키 */
export const INQUIRY_STATUSES = {
  open: "접수",
  in_progress: "처리 중",
  answered: "답변 완료",
  closed: "종결",
} as const;
export type InquiryStatus = keyof typeof INQUIRY_STATUSES;
export const INQUIRY_STATUS_KEYS = Object.keys(INQUIRY_STATUSES) as [
  InquiryStatus,
  ...InquiryStatus[],
];

export const INQUIRY_TITLE_MAX = 120;
export const INQUIRY_BODY_MIN = 10;
export const INQUIRY_BODY_MAX = 5000;
export const INQUIRY_ANSWER_MAX = 5000;
export const INQUIRY_MEMO_MAX = 2000;

/** Postgres text 는 NUL 문자를 받지 않는다 — 500 대신 400 으로 거른다 */
const noNul = (value: string): boolean => !value.includes("\u0000");
const NUL_MESSAGE = "사용할 수 없는 문자가 포함되어 있습니다.";

export const InquiryCreateSchema = z.object({
  category: z.enum(INQUIRY_CATEGORY_KEYS, { message: "문의 분류를 선택해주세요." }),
  title: z
    .string()
    .trim()
    .min(2, "제목을 2자 이상 입력해주세요.")
    .max(INQUIRY_TITLE_MAX, `제목은 ${INQUIRY_TITLE_MAX}자 이하로 입력해주세요.`)
    .refine(noNul, NUL_MESSAGE),
  body: z
    .string()
    .trim()
    .min(INQUIRY_BODY_MIN, `문의 내용을 ${INQUIRY_BODY_MIN}자 이상 적어주세요.`)
    .max(INQUIRY_BODY_MAX, `문의 내용은 ${INQUIRY_BODY_MAX.toLocaleString("ko-KR")}자 이하로 입력해주세요.`)
    .refine(noNul, NUL_MESSAGE),
});
export type InquiryCreateInput = z.infer<typeof InquiryCreateSchema>;

const id = z.coerce.number().int().positive();

/** 관리자 처리 — answer: 답변 등록(상태 = 답변 완료), status: 상태만 변경, memo: 내부 메모 */
export const InquiryAdminActionSchema = z.discriminatedUnion("action", [
  z.object({
    id,
    action: z.literal("answer"),
    answer: z
      .string()
      .trim()
      .min(1, "답변 내용을 입력해주세요.")
      .max(INQUIRY_ANSWER_MAX, `답변은 ${INQUIRY_ANSWER_MAX.toLocaleString("ko-KR")}자 이하로 입력해주세요.`)
      .refine(noNul, NUL_MESSAGE),
  }),
  z.object({
    id,
    action: z.literal("status"),
    // "답변 완료"는 답변을 등록해야만 된다 — 답변 없는 완료 표시를 막는다
    status: z.enum(["open", "in_progress", "closed"]),
  }),
  z.object({
    id,
    action: z.literal("memo"),
    memo: z
      .string()
      .trim()
      .max(INQUIRY_MEMO_MAX, `메모는 ${INQUIRY_MEMO_MAX.toLocaleString("ko-KR")}자 이하로 입력해주세요.`)
      .refine(noNul, NUL_MESSAGE),
  }),
]);
export type InquiryAdminAction = z.infer<typeof InquiryAdminActionSchema>;
