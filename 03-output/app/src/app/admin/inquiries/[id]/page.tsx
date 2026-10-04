import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { getInquiryForAdmin } from "@/lib/inquiries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INQUIRY_CATEGORIES, INQUIRY_STATUSES } from "@/lib/validators/inquiry";
import { INQUIRY_STATUS_TONE, formatKst } from "@/app/inquiries/inquiry-ui";
import { InquiryAdminPanel } from "./inquiry-admin-panel";

export const runtime = "edge";
export const metadata = { title: "문의 처리", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

export default async function AdminInquiryDetailPage({ params }: Props) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const user = await requireAdminUser(`/admin/inquiries/${id}`);
  const found = await getInquiryForAdmin(createSupabaseAdminClient(), id);
  if (found.kind === "missing") notFound();
  if (found.kind === "error") {
    return (
      <>
        <SiteHeader user={user} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm font-medium text-red-600">
            문의를 불러오지 못했습니다. 잠시 후 새로고침해주세요.
          </p>
        </main>
      </>
    );
  }
  const inquiry = found.row;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/admin/inquiries" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← 사용자 문의
        </Link>

        <article className="mt-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INQUIRY_STATUS_TONE[inquiry.status]}`}
            >
              {INQUIRY_STATUSES[inquiry.status]}
            </span>
            <span className="text-xs text-neutral-500">{INQUIRY_CATEGORIES[inquiry.category]}</span>
            {!inquiry.slack_notified_at && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                Slack 미전송
              </span>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold text-neutral-900">{inquiry.title}</h1>
          <p className="tabular mt-1 text-xs text-neutral-500">
            #{inquiry.id} · {inquiry.users?.nickname ?? "-"} (회원 #{inquiry.user_id}) ·{" "}
            {inquiry.users?.email ?? "-"} · 접수 {formatKst(inquiry.created_at)}
          </p>
          <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
            {inquiry.body}
          </p>
        </article>

        <InquiryAdminPanel
          id={inquiry.id}
          status={inquiry.status}
          answer={inquiry.answer ?? ""}
          answeredAt={formatKst(inquiry.answered_at)}
          memo={inquiry.admin_memo ?? ""}
        />
      </main>
    </>
  );
}
