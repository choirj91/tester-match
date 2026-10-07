import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { listOwnInquiries } from "@/lib/inquiries";
import { CONTACT_EMAIL, OPEN_CHAT_URL } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INQUIRY_CATEGORIES, INQUIRY_STATUSES } from "@/lib/validators/inquiry";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { INQUIRY_STATUS_BADGE, formatKst } from "./inquiry-ui";

export const metadata = { title: "문의", robots: { index: false, follow: false } };

export default async function InquiriesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="mx-auto max-w-2xl px-5 pt-12 pb-[88px]">
          <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">문의</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
            로그인하면 운영팀에 1:1 문의를 남기고 답변을 받을 수 있습니다. 문의 내용은 본인과
            운영팀만 볼 수 있습니다.
          </p>
          <ButtonLink href="/auth/login?next=/inquiries" className="mt-6">
            로그인하고 문의하기
          </ButtonLink>
          <Notice kind="info" title="로그인이 안 되나요?" className="mt-10">
            이메일{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-ink-900 underline underline-offset-2 hover:text-accent-600">
              {CONTACT_EMAIL}
            </a>{" "}
            또는{" "}
            <a
              href={OPEN_CHAT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-900 underline underline-offset-2 hover:text-accent-600"
            >
              카카오 오픈채팅
            </a>
            으로 알려주세요.
          </Notice>
        </main>
      </>
    );
  }

  const { rows: inquiries, failed } = await listOwnInquiries(createSupabaseAdminClient(), user.id);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-5 pt-12 pb-[88px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">문의</h1>
            <p className="mt-2 text-[15px] text-ink-700">
              운영팀에 남긴 1:1 문의와 답변입니다. 본인과 운영팀만 볼 수 있습니다.
            </p>
          </div>
          <ButtonLink href="/inquiries/new" size="sm" className="shrink-0">
            <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />문의하기
          </ButtonLink>
        </div>

        <div className="mt-8">
          {failed ? (
            <ErrorState
              title="문의 목록을 불러오지 못했습니다."
              description="잠시 후 새로고침해주세요."
            />
          ) : inquiries.length === 0 ? (
            <EmptyState
              title="아직 남긴 문의가 없습니다."
              description="이용 중 궁금한 점이나 문제가 있으면 문의를 남겨주세요. 답변이 등록되면 알림과 메일로 알려드립니다."
            />
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {inquiries.map((q) => (
                <li key={q.id}>
                  <Link
                    href={`/inquiries/${q.id}`}
                    className="block border border-ink-900 bg-white p-5 no-underline hover:bg-surface-1"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={INQUIRY_STATUS_BADGE[q.status]}>{INQUIRY_STATUSES[q.status]}</Badge>
                      <span className="text-[13px] text-ink-600">{INQUIRY_CATEGORIES[q.category]}</span>
                    </div>
                    <p className="mt-2 truncate text-[15px] font-bold text-ink-900">{q.title}</p>
                    <p className="tabular mt-1 text-xs text-ink-600">접수 {formatKst(q.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}
