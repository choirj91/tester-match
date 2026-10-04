import { after } from "next/server";

/**
 * 응답 후에도 완료를 보장해야 하는 비동기 작업 (알림·메일).
 * Next `after()` 에 넘겨 서버가 응답 뒤에도 작업을 끝까지 기다리게 한다.
 * 요청 범위 밖(단위 테스트 등)에서 호출되면 after 가 throw → fire-and-forget.
 */
export async function runAfterResponse(task: Promise<unknown>): Promise<void> {
  const guarded = task.catch((err) => console.error("[runAfterResponse]", err));
  try {
    after(guarded);
  } catch {
    void guarded;
  }
}
