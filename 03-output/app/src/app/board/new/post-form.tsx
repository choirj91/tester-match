"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOTICE_CATEGORY, POST_CATEGORIES } from "@/lib/validators/post";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field label="카테고리">
        {({ id }) => (
          <Select id={id} name="category" defaultValue={POST_CATEGORIES[0]}>
            {POST_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {isAdmin && <option value={NOTICE_CATEGORY}>{NOTICE_CATEGORY} (관리자)</option>}
          </Select>
        )}
      </Field>

      <Field label="제목">
        {({ id }) => (
          <Input
            id={id}
            name="title"
            type="text"
            required
            maxLength={120}
            placeholder="다른 사용자가 글의 핵심을 한 줄로 알 수 있게 적어주세요"
          />
        )}
      </Field>

      <Field label="본문">
        {({ id }) => (
          <Textarea
            id={id}
            name="body"
            rows={12}
            required
            maxLength={10000}
            placeholder="자유롭게 작성하세요. 마크다운은 아직 지원하지 않습니다."
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
          {submitting ? "등록 중..." : "등록"}
        </Button>
      </div>
    </form>
  );
}
