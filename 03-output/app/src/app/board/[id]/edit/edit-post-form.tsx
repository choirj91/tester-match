"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { POST_CATEGORIES, type PostCategory } from "@/lib/validators/post";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field label="카테고리">
        {({ id: fieldId }) => (
          /* "질문" 분류는 없어졌다 — 예전 질문 글을 고칠 때 첫 항목(이야기)이 아니라 "자유"로 둔다 */
          <Select
            id={fieldId}
            name="category"
            defaultValue={initial.category === "질문" ? "자유" : initial.category}
          >
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="제목">
        {({ id: fieldId }) => (
          <Input
            id={fieldId}
            name="title"
            type="text"
            required
            maxLength={120}
            defaultValue={initial.title}
          />
        )}
      </Field>
      <Field label="본문">
        {({ id: fieldId }) => (
          <Textarea
            id={fieldId}
            name="body"
            rows={12}
            required
            maxLength={10000}
            defaultValue={initial.body}
            className="resize-y"
          />
        )}
      </Field>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button type="submit" loading={submitting} className="w-full sm:w-auto">
          {submitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
