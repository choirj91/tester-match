"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

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

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* 건수 */}
      <p className="text-sm text-neutral-500">
        총 <strong className="text-neutral-700">{total}</strong>개
        {totalPages > 1 && (
          <span className="ml-1 text-neutral-400">
            · {startItem}–{endItem} 표시
          </span>
        )}
      </p>

      {/* 정렬 + 뷰 토글 */}
      <div className="flex items-center gap-2">
        <select
          value={sort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 shadow-sm focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20 sm:flex-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setParam("view", "card")}
            aria-label="카드 보기"
            className={`px-3 py-1.5 text-sm font-medium transition ${
              view === "card" ? "bg-trust-600 text-white" : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            ⊞
          </button>
          <button
            type="button"
            onClick={() => setParam("view", "list")}
            aria-label="리스트 보기"
            className={`border-l border-neutral-200 px-3 py-1.5 text-sm font-medium transition ${
              view === "list" ? "bg-trust-600 text-white" : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            ≡
          </button>
        </div>
      </div>
    </div>
  );
}
