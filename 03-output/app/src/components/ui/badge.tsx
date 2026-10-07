import type { ReactNode } from "react";
import { cx } from "./cx";

export type BadgeTone = "accent" | "ink" | "outline" | "success" | "warning" | "danger";

const TONE: Record<BadgeTone, string> = {
  accent: "bg-accent-600 text-white",
  ink: "bg-ink-900 text-white",
  outline: "border border-ink-900 bg-white text-ink-900",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};

/** 상태 배지 — 색만으로 전달하지 않도록 글자는 필수 */
export function Badge({
  tone = "outline",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center px-2.5 py-1 text-xs leading-none font-medium whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** 결제 오픈 전까지만 쓰는 배지. 결제가 열리면 이 컴포넌트와 사용처를 지운다 */
export function PaymentPendingBadge({ className }: { className?: string }) {
  return (
    <Badge tone="outline" className={className}>
      결제 오픈 대기
    </Badge>
  );
}
