import { z } from "zod";
import { PAID_TESTER_MAX_COUNT, PAID_TESTER_MIN_COUNT } from "@/lib/paid-testers";

export const PaidOrderCreateSchema = z.object({
  app_id: z.coerce.number().int().positive("앱을 선택해주세요."),
  tester_count: z.coerce
    .number()
    .int("테스터 인원은 정수여야 합니다.")
    .min(PAID_TESTER_MIN_COUNT, `최소 ${PAID_TESTER_MIN_COUNT}명부터 신청할 수 있습니다.`)
    .max(PAID_TESTER_MAX_COUNT, `최대 ${PAID_TESTER_MAX_COUNT}명까지 신청할 수 있습니다.`),
});

export type PaidOrderCreateInput = z.infer<typeof PaidOrderCreateSchema>;
