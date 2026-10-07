"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "./cx";

const CONTROL =
  "w-full border border-ink-900 bg-white px-3.5 text-[15px] text-ink-900 placeholder:text-ink-600 focus:outline-[3px] focus:outline-offset-0 focus:outline-accent-600 disabled:border-ink-200 disabled:bg-surface-1 disabled:text-ink-600 aria-[invalid=true]:border-danger-700";

/** 레이블 + 컨트롤 + 도움말/오류. 오류는 테두리·아이콘·문구 셋으로 알린다 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      {children({ id, describedBy: error || hint ? msgId : undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={msgId} className="flex items-center gap-1.5 text-[13px] text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={msgId} className="text-[13px] text-ink-600">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cx(CONTROL, "h-12", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cx(CONTROL, "h-12", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cx(CONTROL, "min-h-28 py-3", className)} {...rest} />;
}

/** 체크박스 — 터치 영역 44px */
export function Checkbox({
  label,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return (
    <label className={cx("flex min-h-11 cursor-pointer items-center gap-3 text-[15px] text-ink-900", className)}>
      <input
        type="checkbox"
        className="size-5 shrink-0 cursor-pointer appearance-none border-[1.5px] border-ink-900 bg-white bg-center bg-no-repeat checked:bg-ink-900 checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22><path d=%22M5 10.5l3.2 3.2L15 7%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.2%22/></svg>')] disabled:border-ink-200"
        {...rest}
      />
      <span>{label}</span>
    </label>
  );
}

export type ConsentItem = {
  key: string;
  label: ReactNode;
  href?: string;
  required?: boolean;
};

/** 동의 목록 — 항목별 체크 + 정책 링크, "전체 동의"는 따로 위에 둔다 */
export function ConsentList({
  items,
  checked,
  onChange,
  showAllToggle = true,
}: {
  items: ReadonlyArray<ConsentItem>;
  checked: Readonly<Record<string, boolean>>;
  onChange: (next: Record<string, boolean>) => void;
  /** 항목을 하나씩 확인받아야 하는 동의(구매 전 유의사항 등)는 끈다 */
  showAllToggle?: boolean;
}) {
  const allChecked = items.every((i) => checked[i.key]);
  const setAll = (value: boolean) =>
    onChange(Object.fromEntries(items.map((i) => [i.key, value])));
  return (
    <fieldset className="m-0 flex flex-col border border-ink-900 p-0">
      <legend className="sr-only">약관 동의</legend>
      {showAllToggle && (
        <div className="border-b border-ink-900 px-4 py-1">
        <Checkbox
          label={<strong>전체 동의</strong>}
          checked={allChecked}
          onChange={(e) => setAll(e.currentTarget.checked)}
        />
        </div>
      )}
      <ul className="m-0 flex list-none flex-col px-4 py-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3">
            <Checkbox
              label={
                <>
                  <span className="font-mono text-xs text-ink-600">{item.required ? "[필수]" : "[선택]"}</span>{" "}
                  {item.label}
                </>
              }
              checked={Boolean(checked[item.key])}
              onChange={(e) => onChange({ ...checked, [item.key]: e.currentTarget.checked })}
            />
            {item.href && (
              <Link
                href={item.href}
                target="_blank"
                className="inline-flex min-h-11 shrink-0 items-center text-[13px] text-ink-900 underline hover:text-accent-600"
              >
                보기
              </Link>
            )}
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
