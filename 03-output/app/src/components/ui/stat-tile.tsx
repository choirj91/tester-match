import type { ReactNode } from "react";
import { cx } from "./cx";

/** 숫자 타일 — 레이블 12px / 값 세리프 24px. 그리드로 3~4개 묶어 쓴다 */
export function StatTile({
  label,
  value,
  rule = false,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  /** 타일마다 상단 괘선 (묶음 위에 괘선이 이미 있으면 끈다) */
  rule?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-0.5", rule && "border-t-[1.5px] border-ink-900 pt-3", className)}>
      <dt className="text-xs text-ink-600">{label}</dt>
      <dd className="m-0 font-display text-2xl font-semibold text-ink-900 tabular-nums">{value}</dd>
    </div>
  );
}

export function StatTiles({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <dl className={cx("m-0 grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-4", className)}>
      {children}
    </dl>
  );
}
