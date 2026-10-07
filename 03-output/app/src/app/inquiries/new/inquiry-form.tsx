"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  INQUIRY_BODY_MAX,
  INQUIRY_BODY_MIN,
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_KEYS,
  INQUIRY_TITLE_MAX,
} from "@/lib/validators/inquiry";

const inputClass =
  "w-full  border border-ink-900 bg-white px-3 py-2.5 text-sm  placeholder:text-ink-600 focus:border-ink-900 focus:outline-none focus:ring-1 focus:ring-accent-600";

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
    <form onSubmit={onSubmit} className="mt-6 space-y-5">
      <div>
        <label htmlFor="inquiry-category" className="mb-1.5 block text-sm font-medium text-ink-900">
          분류
        </label>
        <select id="inquiry-category" name="category" defaultValue="" required className={inputClass}>
          <option value="" disabled>
            선택해주세요
          </option>
          {INQUIRY_CATEGORY_KEYS.map((key) => (
            <option key={key} value={key}>
              {INQUIRY_CATEGORIES[key]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="inquiry-title" className="mb-1.5 block text-sm font-medium text-ink-900">
          제목
        </label>
        <input
          id="inquiry-title"
          name="title"
          type="text"
          required
          minLength={2}
          maxLength={INQUIRY_TITLE_MAX}
          placeholder="무엇을 도와드릴까요?"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="inquiry-body" className="mb-1.5 block text-sm font-medium text-ink-900">
          내용
        </label>
        <textarea
          id="inquiry-body"
          name="body"
          required
          minLength={INQUIRY_BODY_MIN}
          maxLength={INQUIRY_BODY_MAX}
          rows={10}
          onChange={(e) => setBodyLength(e.target.value.length)}
          placeholder="상황을 구체적으로 적어주세요. 앱 이름, 발생 시각, 화면에 보인 문구가 있으면 더 빨리 확인할 수 있습니다."
          className={inputClass}
        />
        <p className="tabular mt-1 text-right text-xs text-ink-600">
          {bodyLength.toLocaleString("ko-KR")} / {INQUIRY_BODY_MAX.toLocaleString("ko-KR")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          비밀번호, 카드번호, 주민등록번호 같은 민감한 정보는 적지 마세요.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-danger-700">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-ink-900 hover:bg-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "접수 중..." : "문의 접수"}
      </button>
    </form>
  );
}
