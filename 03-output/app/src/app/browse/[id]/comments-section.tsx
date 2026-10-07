"use client";

import { ArrowRight, Link2, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBadge } from "@/components/admin-badge";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/state";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  author_user_id: number;
  author_nickname: string;
  author_role?: string;
  promoted_app_id: number | null;
  promoted_app_name: string | null;
};

type PromotableApp = { id: number; name: string };

type Props = {
  appId: number;
  currentUserId: number;
  initialComments: Comment[];
  ownPromotableApps: PromotableApp[];
};

export function AppCommentsSection({
  appId,
  currentUserId,
  initialComments,
  ownPromotableApps,
}: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [body, setBody] = useState("");
  const [promotedAppId, setPromotedAppId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promotedAppName = promotedAppId
    ? ownPromotableApps.find((a) => a.id === promotedAppId)?.name ?? null
    : null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/apps/${appId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, promoted_app_id: promotedAppId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: number;
      message?: string;
    };
    if (!res.ok || !data.ok) {
      setError(data.message ?? "댓글 작성 실패");
      setSubmitting(false);
      return;
    }
    setComments((prev) => [
      {
        id: data.id ?? Date.now(),
        body,
        created_at: new Date().toISOString(),
        author_user_id: currentUserId,
        author_nickname: "나",
        promoted_app_id: promotedAppId,
        promoted_app_name: promotedAppName,
      },
      ...prev,
    ]);
    setBody("");
    setPromotedAppId(null);
    setPickerOpen(false);
    setSubmitting(false);
    router.refresh();
  }

  async function onDelete(id: number) {
    if (!confirm("댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/app-comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-12 flex flex-col gap-4 border-t border-ink-900 pt-8">
      <div className="flex flex-col gap-1">
        <h2 id="comments-heading" className="m-0 font-display text-h2 font-semibold text-ink-900">
          댓글 <span className="font-mono text-ink-600 tabular-nums">{comments.length}</span>
        </h2>
        <p className="m-0 text-sm text-ink-700">
          다른 개발자에게 인사하거나, 내 앱 링크를 걸어 품앗이 요청을 남겨보세요.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="comment-body" className="sr-only">
          댓글 내용
        </label>
        <Textarea
          id="comment-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          required
          placeholder="저도 테스터 참여 중입니다. 제 앱도 한 번 봐주실래요?"
          className="resize-y"
        />

        {/* 내 앱 링크 걸기 picker */}
        <div className="relative">
          {promotedAppId && promotedAppName ? (
            <div className="flex items-center justify-between gap-3 border border-ink-900 bg-surface-1 px-3">
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-900">
                <Link2 className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                첨부: <strong className="font-semibold">{promotedAppName}</strong>
              </span>
              <Button variant="text" size="sm" onClick={() => setPromotedAppId(null)}>
                제거
              </Button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={ownPromotableApps.length === 0}
              aria-expanded={pickerOpen}
              title={ownPromotableApps.length === 0 ? "첨부 가능한 본인 앱이 없습니다" : ""}
            >
              <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
              내 앱 링크 걸기
            </Button>
          )}

          {pickerOpen && !promotedAppId && (
            <ul className="absolute z-10 m-0 mt-1 max-h-60 w-full list-none overflow-auto border border-ink-900 bg-white p-0 sm:w-72">
              {ownPromotableApps.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPromotedAppId(a.id);
                      setPickerOpen(false);
                    }}
                    className="flex min-h-11 w-full items-center justify-between px-3 text-left text-sm text-ink-900 hover:bg-surface-1"
                  >
                    <span className="truncate">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="m-0 text-[13px] text-danger-700">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" loading={submitting} disabled={body.trim().length === 0}>
            댓글 등록
          </Button>
        </div>
      </form>

      {comments.length === 0 ? (
        <EmptyState title="첫 댓글을 작성해보세요." />
      ) : (
        <ul className="m-0 list-none border-t border-ink-900 p-0">
          {comments.map((c) => (
            <li
              key={c.id}
              className={cx("border-b border-ink-200 px-3 py-4", c.author_role === "admin" ? "bg-surface-1" : "bg-white")}
            >
              <div className="flex items-center justify-between gap-4 text-xs text-ink-600">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <strong className="text-ink-900">{c.author_nickname}</strong>
                  {c.author_role === "admin" && <AdminBadge />}
                  {" · "}
                  <span className="font-mono tabular-nums">{new Date(c.created_at).toLocaleString("ko-KR")}</span>
                </span>
                {c.author_user_id === currentUserId && (
                  <Button variant="text" size="sm" onClick={() => onDelete(c.id)} className="shrink-0">
                    삭제
                  </Button>
                )}
              </div>
              <p className="m-0 mt-2 text-sm leading-relaxed whitespace-pre-wrap text-ink-900">{c.body}</p>
              {c.promoted_app_id && c.promoted_app_name && (
                <Link
                  href={`/browse/${c.promoted_app_id}`}
                  className="mt-3 inline-flex min-h-11 items-center gap-2 border border-ink-900 bg-white px-3 text-xs font-semibold text-ink-900 hover:bg-surface-1"
                >
                  <Link2 className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  첨부 앱: {c.promoted_app_name}
                  <ArrowRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
