import type { ReactNode } from "react";

export type StepItem = { title: ReactNode; desc: ReactNode };

/** 진행 단계 — 상단 1.5px 괘선 + mono 번호 + 굵은 제목 + 설명 */
export function Steps({ items }: { items: ReadonlyArray<StepItem> }) {
  return (
    <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-6 p-0">
      {items.map((item, i) => (
        <li key={i} className="flex flex-col gap-2 border-t-[1.5px] border-ink-900 pt-3.5">
          <span className="font-mono text-xs text-ink-600 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
          <strong className="text-[17px] font-bold text-ink-900">{item.title}</strong>
          <span className="text-sm text-ink-700">{item.desc}</span>
        </li>
      ))}
    </ol>
  );
}
