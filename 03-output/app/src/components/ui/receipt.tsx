import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * 영수증 — 돈이 오가는 정보(가격·쓰임·환불)는 모두 이 틀로 보여 준다.
 * 1.5px 먹선 테두리, 점선 구분, mono 항목/값 양끝 정렬.
 */
export function Receipt({
  title,
  badge,
  meta,
  footer,
  className,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex w-full flex-col gap-3.5 border-[1.5px] border-ink-900 bg-white px-[26px] py-7",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-display text-xl font-semibold text-ink-900">{title}</span>
        {badge}
      </div>
      {meta && <p className="font-mono text-xs text-ink-600">{meta}</p>}
      {children}
      {footer && <p className="text-xs leading-relaxed text-ink-600">{footer}</p>}
    </div>
  );
}

export function ReceiptDivider() {
  return <div className="border-t border-dashed border-ink-900" />;
}

export function ReceiptRows({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx("flex flex-col gap-2.5 font-mono text-sm text-ink-900 tabular-nums", className)}>
      {children}
    </div>
  );
}

export function ReceiptRow({
  label,
  value,
  tone = "ink",
  strong = false,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: "ink" | "accent";
  strong?: boolean;
}) {
  return (
    <div className={cx("flex justify-between gap-3", strong && "font-bold")}>
      <span>{label}</span>
      <span className={tone === "accent" ? "text-accent-600" : undefined}>{value}</span>
    </div>
  );
}
