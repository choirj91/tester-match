"use client";

import Link from "next/link";
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
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-ink-900">
        댓글 <span className="tabular text-ink-600">{comments.length}</span>
      </h2>
      <p className="mt-1 text-xs text-ink-600">
        다른 개발자에게 인사하거나, 내 앱 링크를 걸어 품앗이 요청을 남겨보세요.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3 border border-ink-200 bg-white p-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={1000}
          required
          placeholder="저도 테스터 참여 중입니다. 제 앱도 한 번 봐주실래요?"
          className="w-full resize-y border border-ink-900 bg-white px-3 py-2.5 text-sm placeholder:text-ink-600 focus:border-ink-900 focus:outline-none focus:ring-2 focus:ring-accent-600"
        />

        {/* 내 앱 링크 걸기 picker */}
        <div className="relative">
          {promotedAppId && promotedAppName ? (
            <div className="flex items-center justify-between border border-ink-200 bg-surface-1 px-3 py-2">
              <span className="text-sm text-ink-900">
                🔗 첨부:{" "}
                <strong className="font-semibold">{promotedAppName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setPromotedAppId(null)}
                className="text-xs text-ink-900 hover:text-ink-900"
              >
                제거
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              disabled={ownPromotableApps.length === 0}
              className="border border-ink-900 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-surface-1 disabled:opacity-50"
              title={ownPromotableApps.length === 0 ? "첨부 가능한 본인 앱이 없습니다" : ""}
            >
              + 내 앱 링크 걸기
            </button>
          )}

          {pickerOpen && !promotedAppId && (
            <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto border border-ink-200 bg-white sm:w-72">
              {ownPromotableApps.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPromotedAppId(a.id);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink-900 hover:bg-surface-1"
                  >
                    <span className="truncate">{a.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger-700">
            {error}
          </p>
        )}

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

      <ul className="mt-6 space-y-3">
        {comments.length === 0 ? (
          <li className="border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-600">
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
                {c.body}
              </p>
              {c.promoted_app_id && c.promoted_app_name && (
                <Link
                  href={`/browse/${c.promoted_app_id}`}
                  className="mt-3 inline-flex items-center gap-2 border border-ink-200 bg-surface-1 px-3 py-2 text-xs font-semibold text-ink-900 hover:bg-surface-1"
                >
                  🔗 첨부 앱: {c.promoted_app_name} →
                </Link>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
