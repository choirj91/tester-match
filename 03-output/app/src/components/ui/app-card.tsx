import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * 매칭 목록 앱 카드 — 1px 먹선, 직각. 유료 시트가 있으면 버밀리언 1.5px 테두리로 올린다.
 */
export function AppCard({
  name,
  badges,
  description,
  meta,
  action,
  highlighted = false,
  className,
}: {
  name: ReactNode;
  badges?: ReactNode;
  description?: ReactNode;
  /** mono 꼬리 — 예: "테스터 8/12 · 남은 6일" */
  meta?: ReactNode;
  action?: ReactNode;
  /** 유료 시트가 열린 앱 */
  highlighted?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cx(
        "flex flex-col gap-3 bg-white p-5",
        highlighted ? "border-[1.5px] border-accent-600" : "border border-ink-900",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 font-display text-xl font-semibold text-ink-900">{name}</h3>
        {badges && <div className="flex flex-wrap gap-1.5">{badges}</div>}
      </div>
      {description && <p className="m-0 text-[15px] text-ink-700">{description}</p>}
      {(meta || action) && (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
          {meta && <span className="font-mono text-[13px] text-ink-900 tabular-nums">{meta}</span>}
          {action}
        </div>
      )}
    </article>
  );
}
