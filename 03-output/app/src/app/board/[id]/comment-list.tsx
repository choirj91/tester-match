"use client";

import { Linkify } from "@/components/linkify";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminBadge } from "@/components/admin-badge";

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
      <form onSubmit={onSubmit} className="mt-4 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          required
          placeholder="댓글을 입력하세요"
          className="w-full resize-y border border-ink-900 bg-white px-3 py-2.5 text-sm placeholder:text-ink-600 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-600"
        />
        {error && <p className="text-sm text-danger-700">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || body.trim().length === 0}
            className="bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {submitting ? "등록 중..." : "댓글 등록"}
          </button>
        </div>
      </form>

      <ul className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <li className="border border-dashed border-ink-200 px-4 py-6 text-center text-sm text-ink-600">
            첫 댓글을 작성해보세요.
          </li>
        ) : (
          comments.map((c) => (
            <li
              key={c.id}
              className={` border p-4 ${
                c.author_role === "admin"
                  ? "border-ink-200 bg-surface-1"
                  : "border-ink-200 bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-xs text-ink-600">
                <span className="inline-flex items-center gap-1.5">
                  <strong className="text-ink-700">{c.author_nickname}</strong>
                  {c.author_role === "admin" && <AdminBadge />}
                  {" · "}
                  {new Date(c.created_at).toLocaleString("ko-KR")}
                </span>
                {c.author_user_id === currentUserId && (
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    className="text-xs text-ink-600 hover:text-danger-700"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-900">
                <Linkify text={c.body} />
              </p>
            </li>
          ))
        )}
      </ul>
    </>
  );
}
