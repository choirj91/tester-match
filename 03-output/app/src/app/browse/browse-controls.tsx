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
  count,
}: {
  sort: SortKey;
  view: "card" | "list";
  count: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, value);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-neutral-500">앱 {count}개</p>

      {/* 모바일: 정렬 + 뷰 토글을 한 줄에 나란히 */}
      <div className="flex items-center gap-2">
        {/* 정렬 — 모바일에서 flex-1로 늘어남 */}
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

        {/* 뷰 토글 — shrink-0으로 고정 */}
        <div className="flex shrink-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setParam("view", "card")}
            aria-label="카드 보기"
            className={`px-3 py-1.5 text-sm font-medium transition ${
              view === "card"
                ? "bg-trust-600 text-white"
                : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            ⊞
          </button>
          <button
            type="button"
            onClick={() => setParam("view", "list")}
            aria-label="리스트 보기"
            className={`border-l border-neutral-200 px-3 py-1.5 text-sm font-medium transition ${
              view === "list"
                ? "bg-trust-600 text-white"
                : "text-neutral-500 hover:bg-neutral-50"
            }`}
          >
            ≡
          </button>
        </div>
      </div>
    </div>
  );
}
