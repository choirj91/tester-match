import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { getOwnInquiry } from "@/lib/inquiries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INQUIRY_CATEGORIES, INQUIRY_STATUSES } from "@/lib/validators/inquiry";
import { INQUIRY_STATUS_TONE, formatKst } from "../inquiry-ui";

export const metadata = { title: "문의 내역", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }> };

export default async function InquiryDetailPage({ params }: Props) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/auth/login?next=/inquiries/${id}`);

  // 본인 문의만 조회한다 — 남의 문의는 "없는 문의"와 똑같이 보인다 (존재 여부를 알려주지 않는다)
  const found = await getOwnInquiry(createSupabaseAdminClient(), id, user.id);
  if (found.kind === "missing") notFound();
  if (found.kind === "error") {
    return (
      <>
        <SiteHeader user={user} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <p className="text-sm font-medium text-danger-700">
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
        <Link href="/inquiries" className="text-sm text-ink-600 hover:text-ink-900">
          ← 내 문의
        </Link>

        <article className="mt-4 border border-ink-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <span
              className={` px-2.5 py-0.5 text-xs font-semibold ${INQUIRY_STATUS_TONE[inquiry.status]}`}
            >
              {INQUIRY_STATUSES[inquiry.status]}
            </span>
            <span className="text-xs text-ink-600">{INQUIRY_CATEGORIES[inquiry.category]}</span>
          </div>
          <h1 className="mt-3 text-xl font-bold text-ink-900">{inquiry.title}</h1>
          <p className="tabular mt-1 text-xs text-ink-600">접수 {formatKst(inquiry.created_at)}</p>
          <p className="mt-5 text-sm leading-relaxed whitespace-pre-wrap text-ink-900">
            {inquiry.body}
          </p>
        </article>

        <section className="mt-4 border border-ink-200 bg-surface-1 p-6">
          <h2 className="text-sm font-bold text-ink-900">운영팀 답변</h2>
          {inquiry.answer ? (
            <>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-ink-900">
                {inquiry.answer}
              </p>
              <p className="tabular mt-3 text-xs text-ink-600">
                답변 {formatKst(inquiry.answered_at)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-700">
              아직 답변이 등록되지 않았습니다. 답변이 등록되면 사이트 알림과 메일로 알려드립니다.
            </p>
          )}
        </section>

        <p className="mt-6 text-xs text-ink-600">
          추가로 궁금한 점이 있으면{" "}
          <Link href="/inquiries/new" className="text-ink-900 underline underline-offset-2">
            새 문의
          </Link>
          를 남겨주세요.
        </p>
      </main>
    </>
  );
}
