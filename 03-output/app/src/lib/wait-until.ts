/**
 * 응답 후에도 완료를 보장해야 하는 비동기 작업 (알림·메일).
 * Cloudflare 에선 ctx.waitUntil, 로컬 next dev 에선 getRequestContext 가 throw → fire-and-forget.
 */
export async function runAfterResponse(task: Promise<unknown>): Promise<void> {
  const guarded = task.catch((err) => console.error("[runAfterResponse]", err));
  try {
    const { getRequestContext } = await import("@cloudflare/next-on-pages");
    getRequestContext().ctx.waitUntil(guarded);
  } catch {
    void guarded;
  }
}
