"use client";

import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EDITABLE_APP_STATUSES } from "@/lib/app-status";
import { TESTER_GROUP_URL, PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Notice } from "@/components/ui/notice";

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
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field label="닉네임">
        {({ id }) => (
          <Input
            id={id}
            name="nickname"
            type="text"
            defaultValue={initial.nickname}
            maxLength={32}
            required
          />
        )}
      </Field>

      <Field label="앱 이름">
        {({ id }) => (
          <Input
            id={id}
            name="name"
            type="text"
            defaultValue={initial.name}
            maxLength={100}
            required
          />
        )}
      </Field>

      <Field label="안드로이드 링크">
        {({ id }) => (
          <Input
            id={id}
            name="store_invite_url"
            type="url"
            defaultValue={initial.store_invite_url}
            required
          />
        )}
      </Field>

      <Field label="웹 참여 링크">
        {({ id }) => (
          <Input
            id={id}
            name="web_invite_url"
            type="url"
            defaultValue={initial.web_invite_url}
            required
          />
        )}
      </Field>

      {/* 공용 테스터 그룹 (고정) */}
      <div className="border border-ink-900 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success">자동 설정</Badge>
          <p className="text-[15px] font-bold text-ink-900">Google 그룹 — 공용 테스터 그룹</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          저장 시 공용 그룹 <strong className="break-all font-semibold text-ink-900">{PLAY_GROUP_EMAIL}</strong> 으로
          설정됩니다. Play Console 비공개 테스트 트랙의 테스터 목록에 이 그룹 이메일을 등록해주세요.
          Tester Match 회원은 자동으로 이 그룹에 가입되어 있습니다.
        </p>
        {initial.google_group_url && initial.google_group_url !== TESTER_GROUP_URL && (
          <Notice kind="caution" className="mt-3">
            현재 개별 그룹(<span className="break-all">{initial.google_group_url}</span>)을 쓰고 있습니다.
            저장하면 공용 그룹으로 변경되니, Play Console 테스터 목록에도 공용 그룹 이메일을 추가해주세요.
          </Notice>
        )}
      </div>

      <Field label="목표 테스터 수">
        {({ id }) => (
          <Input
            id={id}
            name="required_testers"
            type="number"
            min={0}
            max={100}
            defaultValue={initial.required_testers}
            required
            className="font-mono tabular-nums"
          />
        )}
      </Field>

      <Field label="앱 설명">
        {({ id }) => (
          <Textarea
            id={id}
            name="short_description"
            rows={3}
            defaultValue={initial.short_description}
            required
            className="resize-y"
          />
        )}
      </Field>

      <Field label="상태">
        {({ id }) => (
          <Select id={id} name="status" defaultValue={initial.status}>
            {EDITABLE_APP_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 bg-danger-50 px-3 py-2.5 text-sm text-danger-700">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit" loading={submitting} className="w-full sm:w-auto">
          {submitting ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
