"use client";

import { Linkify } from "@/components/linkify";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBadge } from "@/components/admin-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";

type Comment = {
  id: number;
  body: string;
  created_at: string;
  author_user_id: number;
  author_nickname: string;
  author_role?: string;
};

type Props = {
  postId: number;
  currentUserId: number;
  currentUserRole?: string;
  initialComments: Comment[];
};

export function CommentList({ postId, currentUserId, currentUserRole, initialComments }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = (await res.json()) as { ok: boolean; id?: number; message?: string };
    if (!res.ok || !data.ok) {
      setError(data.message ?? "댓글 작성 실패");
      setSubmitting(false);
      return;
    }
    setComments((prev) => [
      ...prev,
      {
        id: data.id ?? Date.now(),
        body,
        created_at: new Date().toISOString(),
        author_user_id: currentUserId,
        author_nickname: "나",
        author_role: currentUserRole,
      },
    ]);
    setBody("");
    setSubmitting(false);
    router.refresh();
  }

  async function onDelete(id: number) {
    if (!confirm("댓글을 삭제할까요?")) return;
    const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제 실패");
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-2">
        <Textarea
          aria-label="댓글"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          required
          placeholder="댓글을 입력하세요"
          aria-invalid={error ? true : undefined}
          className="resize-y"
        />
        {error && (
          <p role="alert" className="text-[13px] text-danger-700">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={submitting}
            disabled={body.trim().length === 0}
          >
            {submitting ? "등록 중..." : "댓글 등록"}
          </Button>
        </div>
      </form>

      <ul className="m-0 mt-6 list-none divide-y divide-ink-200 border-t border-ink-900 p-0">
        {comments.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-ink-700">첫 댓글을 작성해보세요.</li>
        ) : (
          comments.map((c) => (
            <li
              key={c.id}
              className={`px-4 py-4 ${c.author_role === "admin" ? "bg-surface-1" : "bg-white"}`}
            >
              <div className="flex items-center justify-between gap-4 text-[13px] text-ink-600">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <strong className="text-ink-900">{c.author_nickname}</strong>
                  {c.author_role === "admin" && <AdminBadge />}
                  {" · "}
                  <span className="tabular">{new Date(c.created_at).toLocaleString("ko-KR")}</span>
                </span>
                {c.author_user_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="inline-flex min-h-11 items-center text-[13px] text-ink-700 underline hover:text-danger-700"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-900">
                <Linkify text={c.body} />
              </p>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
