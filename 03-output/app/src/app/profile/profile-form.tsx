"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

type Props = { initialNickname: string; initialKakaoNickname: string };

export function ProfileForm({ initialNickname, initialKakaoNickname }: Props) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [kakaoNickname, setKakaoNickname] = useState(initialKakaoNickname);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const dirty =
    nickname.trim() !== initialNickname || kakaoNickname.trim() !== initialKakaoNickname;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;
    setSubmitting(true);
    setMessage(null);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, kakao_nickname: kakaoNickname }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok || !data.ok) {
      setMessage({ type: "err", text: data.message ?? "수정 실패" });
      setSubmitting(false);
      return;
    }
    setMessage({ type: "ok", text: "변경되었습니다." });
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="닉네임">
        {({ id }) => (
          <Input
            id={id}
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={32}
            required
          />
        )}
      </Field>
      <Field
        label={
          <>
            카카오톡 닉네임 <span className="font-normal text-ink-600">(오픈채팅방 이름 · 비공개)</span>
          </>
        }
      >
        {({ id }) => (
          <Input
            id={id}
            type="text"
            value={kakaoNickname}
            onChange={(e) => setKakaoNickname(e.target.value)}
            maxLength={40}
            placeholder="선택 입력"
          />
        )}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={submitting || !dirty}>
          {submitting ? "저장 중..." : "저장"}
        </Button>
        {message && (
          <p
            role="status"
            className={`m-0 text-sm ${message.type === "ok" ? "text-success-700" : "text-danger-700"}`}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
