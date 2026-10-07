import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "text";
export type ButtonSize = "lg" | "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 font-medium no-underline transition-colors disabled:cursor-not-allowed aria-disabled:pointer-events-none";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-black hover:text-white disabled:bg-ink-200 disabled:text-ink-600 aria-disabled:bg-ink-200 aria-disabled:text-ink-600",
  secondary:
    "border-[1.5px] border-ink-900 bg-white text-ink-900 hover:bg-surface-1 disabled:border-ink-200 disabled:text-ink-600 aria-disabled:border-ink-200 aria-disabled:text-ink-600",
  text: "border-b-[1.5px] border-ink-900 text-ink-900 hover:border-accent-600 hover:text-accent-600 disabled:border-ink-200 disabled:text-ink-600",
};

/** 높이: 히어로 54 / 일반 48 / 인라인 44 */
const SIZE: Record<ButtonSize, string> = {
  lg: "min-h-[54px] px-7 text-base",
  md: "min-h-12 px-5 text-[15px]",
  sm: "min-h-11 px-4 text-sm",
};

function classes(variant: ButtonVariant, size: ButtonSize, className?: string) {
  // text 버튼은 좌우 여백 없이 밑줄만
  const sizing = variant === "text" ? SIZE[size].replace(/px-\d+/, "px-0") : SIZE[size];
  return cx(BASE, VARIANT[variant], sizing, className);
}

/** 로딩 중 — 글자 자리에 스피너, 폭은 글자가 잡아 둔다 */
function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 1 1-9 9" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

function Content({ loading, children }: { loading?: boolean; children: ReactNode }) {
  if (!loading) return <>{children}</>;
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className="invisible inline-flex items-center gap-2">{children}</span>
      <span className="absolute inset-0 inline-flex items-center justify-center">
        <Spinner />
      </span>
    </span>
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classes(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content loading={loading}>{children}</Content>
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  disabled = false,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={classes(variant, size, className)}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      {...rest}
    >
      {children}
    </Link>
  );
}
