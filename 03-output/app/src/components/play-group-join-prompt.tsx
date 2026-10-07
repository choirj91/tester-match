import { PLAY_GROUP_JOIN_URL } from "@/lib/tester-group";

/**
 * Play 테스터 자격 그룹(consumer) 가입 유도 인라인 프롬프트.
 * consumer 그룹은 API 자동 추가 불가 → 1클릭 가입 링크 상시 노출.
 */
export function PlayGroupJoinPrompt({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "mt-2 flex flex-wrap items-center gap-2" : "mt-3 flex flex-wrap items-center gap-3"}>
      <a
        href={PLAY_GROUP_JOIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex min-h-11 items-center border-[1.5px] border-ink-900 bg-white font-semibold text-ink-900 hover:bg-surface-1 ${
          compact ? "px-2.5 py-1.5 text-xs" : "px-3 py-1.5 text-xs"
        }`}
      >
        그룹 가입하기 (1클릭) ↗
      </a>
    </div>
  );
}
