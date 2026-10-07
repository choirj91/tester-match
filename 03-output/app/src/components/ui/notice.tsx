import { FileText, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

export type NoticeKind = "info" | "caution" | "legal";

/**
 * 안내 상자 3종 — 색·아이콘·형태로 구분한다. 왼쪽 색 테두리는 쓰지 않는다.
 * info: 먹선 테두리 / caution: 주의 바탕 + 상단 선 / legal: 회색 면 + mono
 */
export function Notice({
  kind = "info",
  title,
  className,
  children,
}: {
  kind?: NoticeKind;
  title?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const Icon = kind === "caution" ? TriangleAlert : kind === "legal" ? FileText : Info;
  return (
    <div
      role={kind === "caution" ? "note" : undefined}
      className={cx(
        "flex gap-3 p-4",
        kind === "info" && "border border-ink-900 bg-white text-ink-700",
        kind === "caution" && "border-t-[1.5px] border-warning-700 bg-warning-50 text-ink-900",
        kind === "legal" && "bg-surface-1 font-mono text-[13px] text-ink-700",
        className,
      )}
    >
      <Icon
        className={cx("mt-0.5 size-[18px] shrink-0", kind === "caution" ? "text-warning-700" : "text-ink-900")}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-col gap-1 text-sm leading-relaxed">
        {title && (
          <p className={cx("font-bold", kind === "caution" ? "text-warning-700" : "text-ink-900")}>{title}</p>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
}
