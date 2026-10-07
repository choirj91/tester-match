"use client";

import { LayoutGrid, List } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Select } from "@/components/ui/form";
import { cx } from "@/components/ui/cx";

export type SortKey = "newest" | "oldest" | "testers" | "status";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "testers", label: "테스터 많은 순" },
  { value: "status", label: "상태순" },
];

export function BrowseControls({
  sort,
  view,
  total,
  page,
  totalPages,
}: {
  sort: SortKey;
  view: "card" | "list";
  total: number;
  page: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      // sort / view 변경 시 페이지를 1로 리셋
      if (key !== "page") params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const startItem = total === 0 ? 0 : (page - 1) * 20 + 1;
  const endItem = Math.min(page * 20, total);

  const toggle = (active: boolean) =>
    cx(
      "flex h-[46px] w-12 items-center justify-center transition-colors",
      active ? "bg-ink-900 text-white" : "bg-white text-ink-900 hover:bg-surface-1",
    );

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* 건수 */}
      <p className="m-0 text-sm text-ink-700">
        총 <strong className="font-mono text-ink-900 tabular-nums">{total}</strong>개
        {totalPages > 1 && (
          <span className="ml-1 font-mono tabular-nums text-ink-600">
            · {startItem}–{endItem} 표시
          </span>
        )}
      </p>

      {/* 정렬 + 뷰 토글 */}
      <div className="flex items-center gap-2">
        <label htmlFor="browse-sort" className="sr-only">
          정렬
        </label>
        <Select
          id="browse-sort"
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="min-w-0 flex-1 sm:w-44 sm:flex-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div className="flex shrink-0 border border-ink-900 bg-white">
          <button
            type="button"
            onClick={() => setParam("view", "card")}
            aria-label="카드 보기"
            aria-pressed={view === "card"}
            className={toggle(view === "card")}
          >
            <LayoutGrid className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setParam("view", "list")}
            aria-label="리스트 보기"
            aria-pressed={view === "list"}
            className={cx(toggle(view === "list"), "border-l border-ink-900")}
          >
            <List className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
