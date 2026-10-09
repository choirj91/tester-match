import { z } from "zod";

export const REDEMPTION_NOTE_MAX = 200;

/** Postgres text 는 NUL 문자를 받지 않는다 — 500 대신 400 으로 거른다 */
const noNul = (value: string): boolean => !value.includes("\u0000");

/**
 * 보상 교환 신청 본문 (ADR-0020). 금액·종류는 받지 않는다 — 서버가 상품 코드로 카탈로그에서 계산한다.
 * 알 수 없는 키(amount, kind 등)는 버린다. 수량 상한·1회 크레딧 상한은 quoteRedemption 이 본다.
 */
export const RedemptionCreateSchema = z.object({
  item_code: z
    .string({ message: "교환할 상품을 골라주세요." })
    .trim()
    .min(1, "교환할 상품을 골라주세요.")
    .max(64, "교환할 수 없는 상품입니다. 목록에서 다시 골라주세요."),
  quantity: z.coerce
    .number({ message: "수량을 1개 이상 골라주세요." })
    .int("수량을 1개 이상 골라주세요.")
    .min(1, "수량을 1개 이상 골라주세요."),
  contact: z
    .string({ message: "보상을 받을 휴대폰 번호를 입력해주세요 (예: 010-1234-5678)." })
    .trim()
    .regex(/^01[016789]-?\d{3,4}-?\d{4}$/, "보상을 받을 휴대폰 번호를 입력해주세요 (예: 010-1234-5678)."),
  note: z
    .string()
    .trim()
    .max(REDEMPTION_NOTE_MAX, `요청 사항은 ${REDEMPTION_NOTE_MAX}자 이하로 적어주세요.`)
    .refine(noNul, "사용할 수 없는 문자가 포함되어 있습니다.")
    .default(""),
});
export type RedemptionCreateInput = z.infer<typeof RedemptionCreateSchema>;
