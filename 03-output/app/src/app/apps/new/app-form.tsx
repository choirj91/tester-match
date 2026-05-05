"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  initialNickname: string;
  email: string;
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-neutral-400 focus:border-trust-600 focus:outline-none focus:ring-2 focus:ring-trust-500/20 disabled:bg-neutral-50 disabled:text-neutral-500";

export function AppForm({ initialNickname, email }: Props) {
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
      store_invite_url: String(fd.get("store_invite_url") ?? "").trim(),
      web_invite_url: String(fd.get("web_invite_url") ?? "").trim(),
      required_testers: Number(fd.get("required_testers") ?? 0),
      short_description: String(fd.get("short_description") ?? "").trim(),
    };

    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; id?: number; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? "등록에 실패했습니다.");
        setSubmitting(false);
        return;
      }
      router.push("/apps");
      router.refresh();
    } catch {
      setError("네트워크 오류. 잠시 후 다시 시도해주세요.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="닉네임" hint="앱 등록 시 발신자 표기명. 변경하면 프로필에도 반영됩니다.">
        <input
          name="nickname"
          type="text"
          defaultValue={initialNickname}
          maxLength={32}
          required
          className={inputClass}
        />
      </Field>

      <Field label="이메일 주소" hint="Google 계정 이메일. 변경할 수 없습니다.">
        <input type="email" value={email} disabled className={inputClass} />
      </Field>

      <Field label="앱 이름">
        <input
          name="name"
          type="text"
          maxLength={100}
          required
          placeholder="예: 모닝 미라클"
          className={inputClass}
        />
      </Field>

      <Field
        label="안드로이드 링크"
        hint="Google Play Console에서 발급받은 Closed Testing 초대 링크 (Android 기기용)."
      >
        <input
          name="store_invite_url"
          type="url"
          required
          placeholder="https://play.google.com/apps/test/..."
          className={inputClass}
        />
      </Field>

      <Field
        label="웹 참여 링크"
        hint="브라우저에서 바로 참여할 수 있는 웹 옵트인 링크."
      >
        <input
          name="web_invite_url"
          type="url"
          required
          placeholder="https://play.google.com/apps/testing/..."
          className={inputClass}
        />
      </Field>

      <Field
        label="목표 테스터 수"
        hint="모집 목표 인원. 보통 12명. 이미 일부 모였다면 부족한 인원수만 입력하세요."
      >
        <input
          name="required_testers"
          type="number"
          min={1}
          max={12}
          defaultValue={12}
          required
          className={`${inputClass} tabular`}
        />
      </Field>

      <Field label="앱 설명" hint="140자 이내. 매칭 페이지에 노출됩니다.">
        <textarea
          name="short_description"
          rows={3}
          maxLength={140}
          required
          placeholder="앱의 핵심 가치와 테스터에게 부탁할 내용을 한 문장으로."
          className={`${inputClass} resize-y`}
        />
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
          {submitting ? "등록 중..." : "앱 등록하기"}
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
