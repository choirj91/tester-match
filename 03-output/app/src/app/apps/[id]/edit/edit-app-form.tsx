"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EDITABLE_APP_STATUSES } from "@/lib/app-status";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";

type Initial = {
  nickname: string;
  name: string;
  short_description: string;
  store_invite_url: string;
  web_invite_url: string;
  google_group_url: string | null;
  required_testers: number;
  status: "matching" | "reviewing" | "launched" | "paused";
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
      // 공용 테스터 그룹 고정 — 저장 시 기존 개별 그룹도 공용 그룹으로 이관
      google_group_url: TESTER_GROUP_URL,
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

      {/* 공용 테스터 그룹 (고정) */}
      <div className="rounded-2xl border border-mint-500/30 bg-mint-500/5 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-mint-500 px-2 py-0.5 text-[10px] font-bold text-white">
            자동 설정
          </span>
          <p className="text-sm font-semibold text-neutral-900">Google 그룹 — 공용 테스터 그룹</p>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
          저장 시 공용 그룹 <strong className="font-semibold text-neutral-800">{PLAY_GROUP_EMAIL}</strong> 으로
          설정됩니다. Play Console 비공개 테스트 트랙의 테스터 목록에 이 그룹 이메일을 등록해주세요.
          Tester Match 회원은 자동으로 이 그룹에 가입되어 있습니다.
        </p>
        {initial.google_group_url && initial.google_group_url !== TESTER_GROUP_URL && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-800">
            현재 개별 그룹(<span className="break-all">{initial.google_group_url}</span>)을 쓰고 있습니다.
            저장하면 공용 그룹으로 변경되니, Play Console 테스터 목록에도 공용 그룹 이메일을 추가해주세요.
          </p>
        )}
      </div>

      <Field label="목표 테스터 수">
        <input
          name="required_testers"
          type="number"
          min={0}
          max={100}
          defaultValue={initial.required_testers}
          required
          className={`${inputClass} tabular`}
        />
      </Field>

      <Field label="앱 설명">
        <textarea
          name="short_description"
          rows={3}
          defaultValue={initial.short_description}
          required
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field label="상태">
        <select name="status" defaultValue={initial.status} className={inputClass}>
          {EDITABLE_APP_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-neutral-900">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-neutral-500">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
