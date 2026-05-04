"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  nickname: string;
  name: string;
  short_description: string;
  store_invite_url: string;
  web_invite_url: string;
  required_testers: number;
  status: "matching" | "paused" | "completed";
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20 disabled:bg-neutral-50";

export function EditAppForm({ id, initial }: { id: number; initial: Initial }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const body = {
      nickname: String(fd.get("nickname") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim(),
      short_description: String(fd.get("short_description") ?? "").trim(),
      store_invite_url: String(fd.get("store_invite_url") ?? "").trim(),
      web_invite_url: String(fd.get("web_invite_url") ?? "").trim(),
      required_testers: Number(fd.get("required_testers") ?? 0),
      status: String(fd.get("status") ?? "matching") as Initial["status"],
    };

    const res = await fetch(`/api/apps/${id}`, {
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
    router.push(`/apps/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="닉네임">
        <input
          name="nickname"
          type="text"
          defaultValue={initial.nickname}
          maxLength={32}
          required
          className={inputClass}
        />
      </Field>

      <Field label="앱 이름">
        <input
          name="name"
          type="text"
          defaultValue={initial.name}
          maxLength={100}
          required
          className={inputClass}
        />
      </Field>

      <Field label="안드로이드 링크">
        <input
          name="store_invite_url"
          type="url"
          defaultValue={initial.store_invite_url}
          required
          className={inputClass}
        />
      </Field>

      <Field label="웹 참여 링크">
        <input
          name="web_invite_url"
          type="url"
          defaultValue={initial.web_invite_url}
          required
          className={inputClass}
        />
      </Field>

      <Field label="현재 남은 테스터 수">
        <input
          name="required_testers"
          type="number"
          min={1}
          max={12}
          defaultValue={initial.required_testers}
          required
          className={`${inputClass} tabular`}
        />
      </Field>

      <Field label="앱 설명">
        <textarea
          name="short_description"
          rows={3}
          maxLength={140}
          defaultValue={initial.short_description}
          required
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field label="상태">
        <select name="status" defaultValue={initial.status} className={inputClass}>
          <option value="matching">매칭 진행중</option>
          <option value="paused">일시정지</option>
          <option value="completed">완료</option>
        </select>
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-crimson-500/10 px-3 py-2 text-sm text-crimson-500">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-900">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
