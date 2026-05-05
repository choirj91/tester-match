"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { POST_CATEGORIES, type PostCategory } from "@/lib/validators/post";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20";

type Initial = { category: string; title: string; body: string };

export function EditPostForm({ id, initial }: { id: number; initial: Initial }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      category: fd.get("category") as PostCategory,
      title: String(fd.get("title") ?? "").trim(),
      body: String(fd.get("body") ?? "").trim(),
    };
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok: boolean; message?: string };
    if (!res.ok || !data.ok) {
      setError(data.message ?? "수정에 실패했습니다.");
      setSubmitting(false);
      return;
    }
    router.push(`/board/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-neutral-900">카테고리</span>
        <div className="mt-2">
          <select name="category" defaultValue={initial.category} className={inputClass}>
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
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
            defaultValue={initial.title}
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
            defaultValue={initial.body}
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
          {submitting ? "저장 중..." : "저장"}
        </button>
      </div>
    </form>
  );
}
