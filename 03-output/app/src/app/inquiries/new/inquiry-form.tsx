"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  INQUIRY_BODY_MAX,
  INQUIRY_BODY_MIN,
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_KEYS,
  INQUIRY_TITLE_MAX,
} from "@/lib/validators/inquiry";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

export function InquiryForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bodyLength, setBodyLength] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      category: fd.get("category"),
      title: String(fd.get("title") ?? "").trim(),
      body: String(fd.get("body") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; id?: number; message?: string };
      if (!res.ok || !data.ok || !data.id) {
        setError(data.message ?? "문의를 접수하지 못했습니다.");
        setSubmitting(false);
        return;
      }
      router.push(`/inquiries/${data.id}`);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
      <Field label="분류">
        {({ id }) => (
          <Select id={id} name="category" defaultValue="" required>
            <option value="" disabled>
              선택해주세요
            </option>
            {INQUIRY_CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>
                {INQUIRY_CATEGORIES[key]}
              </option>
            ))}
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
            minLength={2}
            maxLength={INQUIRY_TITLE_MAX}
            placeholder="무엇을 도와드릴까요?"
          />
        )}
      </Field>

      <Field
        label="내용"
        hint={
          <>
            <span className="tabular block text-right">
              {bodyLength.toLocaleString("ko-KR")} / {INQUIRY_BODY_MAX.toLocaleString("ko-KR")}
            </span>
            <span className="mt-1 block leading-relaxed">
              비밀번호, 카드번호, 주민등록번호 같은 민감한 정보는 적지 마세요.
            </span>
          </>
        }
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            name="body"
            required
            minLength={INQUIRY_BODY_MIN}
            maxLength={INQUIRY_BODY_MAX}
            rows={10}
            onChange={(e) => setBodyLength(e.target.value.length)}
            placeholder="상황을 구체적으로 적어주세요. 앱 이름, 발생 시각, 화면에 보인 문구가 있으면 더 빨리 확인할 수 있습니다."
          />
        )}
      </Field>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}

      <Button type="submit" loading={submitting} className="w-full sm:w-auto sm:self-start">
        {submitting ? "접수 중..." : "문의 접수"}
      </Button>
    </form>
  );
}
