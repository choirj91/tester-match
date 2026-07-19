"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOTICE_CATEGORY, POST_CATEGORIES } from "@/lib/validators/post";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";

export function PostForm({ isAdmin = false }: { isAdmin?: boolean }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      category: fd.get("category"),
      title: String(fd.get("title") ?? "").trim(),
      body: String(fd.get("body") ?? "").trim(),
    };

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; id?: number; message?: string };
    if (!res.ok || !data.ok || !data.id) {
      setError(data.message ?? "작성에 실패했습니다.");
      setSubmitting(false);
      return;
    }
    router.push(`/board/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-neutral-900">카테고리</span>
        <div className="mt-2">
          <select name="category" defaultValue={POST_CATEGORIES[0]} className={inputClass}>
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {isAdmin && <option value={NOTICE_CATEGORY}>📢 {NOTICE_CATEGORY} (관리자)</option>}
          </select>
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-neutral-900">제목</span>
        <div className="mt-2">
          <input
            name="title"
            type="text"
            required
            maxLength={120}
            placeholder="다른 사용자가 글의 핵심을 한 줄로 알 수 있게 적어주세요"
            className={inputClass}
          />
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-neutral-900">본문</span>
        <div className="mt-2">
          <textarea
            name="body"
            rows={12}
            required
            maxLength={10000}
            placeholder="자유롭게 작성하세요. 마크다운은 아직 지원하지 않습니다."
            className={`${inputClass} resize-y`}
          />
        </div>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-500/10 px-3 py-2 text-sm text-crimson-500">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700 disabled:opacity-50"
        >
          {submitting ? "등록 중..." : "등록"}
        </button>
      </div>
    </form>
  );
}
