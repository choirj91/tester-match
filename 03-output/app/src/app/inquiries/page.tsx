import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { listOwnInquiries } from "@/lib/inquiries";
import { CONTACT_EMAIL, OPEN_CHAT_URL } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INQUIRY_CATEGORIES, INQUIRY_STATUSES } from "@/lib/validators/inquiry";
import { INQUIRY_STATUS_TONE, formatKst } from "./inquiry-ui";

export const runtime = "edge";
export const metadata = { title: "문의", robots: { index: false, follow: false } };

export default async function InquiriesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <h1 className="text-2xl font-bold text-neutral-900">문의</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            로그인하면 운영팀에 1:1 문의를 남기고 답변을 받을 수 있습니다. 문의 내용은 본인과
            운영팀만 볼 수 있습니다.
          </p>
          <Link
            href="/auth/login?next=/inquiries"
            className="bg-trust-600 hover:bg-trust-700 mt-6 inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            로그인하고 문의하기
          </Link>
          <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-700">
            <p className="font-semibold text-neutral-900">로그인이 안 되나요?</p>
            <p className="mt-1.5 leading-relaxed">
              이메일{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-trust-600 underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>{" "}
              또는{" "}
              <a
                href={OPEN_CHAT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-trust-600 underline underline-offset-2"
              >
                카카오 오픈채팅
              </a>
              으로 알려주세요.
            </p>
          </div>
        </main>
      </>
    );
  }

  const { rows: inquiries, failed } = await listOwnInquiries(createSupabaseAdminClient(), user.id);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">문의</h1>
            <p className="mt-1 text-sm text-neutral-600">
              운영팀에 남긴 1:1 문의와 답변입니다. 본인과 운영팀만 볼 수 있습니다.
            </p>
          </div>
          <Link
            href="/inquiries/new"
            className="bg-trust-600 hover:bg-trust-700 shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            + 문의하기
          </Link>
        </div>

        {failed ? (
          <p className="mt-8 text-sm font-medium text-red-600">
            문의 목록을 불러오지 못했습니다. 잠시 후 새로고침해주세요.
          </p>
        ) : inquiries.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
            <p className="text-base font-medium text-neutral-700">아직 남긴 문의가 없습니다.</p>
            <p className="mt-2 text-sm text-neutral-600">
              이용 중 궁금한 점이나 문제가 있으면 문의를 남겨주세요. 답변이 등록되면 알림과 메일로
              알려드립니다.
            </p>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {inquiries.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/inquiries/${q.id}`}
                  className="hover:border-trust-500 block rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INQUIRY_STATUS_TONE[q.status]}`}
                    >
                      {INQUIRY_STATUSES[q.status]}
                    </span>
                    <span className="text-xs text-neutral-500">{INQUIRY_CATEGORIES[q.category]}</span>
                  </div>
                  <p className="mt-2 truncate font-semibold text-neutral-900">{q.title}</p>
                  <p className="tabular mt-1 text-xs text-neutral-400">접수 {formatKst(q.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
