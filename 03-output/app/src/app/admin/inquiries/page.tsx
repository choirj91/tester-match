import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { countInquiriesByStatus, listInquiriesForAdmin } from "@/lib/inquiries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  INQUIRY_CATEGORIES,
  INQUIRY_STATUSES,
  INQUIRY_STATUS_KEYS,
  type InquiryStatus,
} from "@/lib/validators/inquiry";
import { INQUIRY_STATUS_TONE, formatKst } from "@/app/inquiries/inquiry-ui";

export const runtime = "edge";
export const metadata = { title: "사용자 문의", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ status?: string }> };

export default async function AdminInquiriesPage({ searchParams }: Props) {
  const user = await requireAdminUser("/admin/inquiries");
  const { status: rawStatus } = await searchParams;
  const active = (INQUIRY_STATUS_KEYS as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as InquiryStatus)
    : null;

  const supabase = createSupabaseAdminClient();
  const [filtered, counts] = await Promise.all([
    listInquiriesForAdmin(supabase, active),
    countInquiriesByStatus(supabase),
  ]);
  const show = (n: number | null): string => (n === null ? "?" : String(n));
  const total = INQUIRY_STATUS_KEYS.every((k) => counts[k] !== null)
    ? INQUIRY_STATUS_KEYS.reduce((sum, k) => sum + (counts[k] ?? 0), 0)
    : null;
  const waiting =
    counts.open === null || counts.in_progress === null ? null : counts.open + counts.in_progress;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-bold text-neutral-900">사용자 문의</h1>
        <p className="mt-1 text-sm text-neutral-600">
          처리 대기 <strong>{show(waiting)}건</strong>. 문의가 접수되면 Slack 으로 알림이 옵니다.
          답변을 등록하면 작성자에게 사이트 알림과 메일이 갑니다. 목록은 최근 200건까지 보입니다.
        </p>

        <nav className="mt-6 flex flex-wrap gap-2 text-sm">
          <FilterLink href="/admin/inquiries" label={`전체 ${show(total)}`} on={active === null} />
          {INQUIRY_STATUS_KEYS.map((key) => (
            <FilterLink
              key={key}
              href={`/admin/inquiries?status=${key}`}
              label={`${INQUIRY_STATUSES[key]} ${show(counts[key])}`}
              on={active === key}
            />
          ))}
        </nav>

        {filtered.error ? (
          <p className="mt-10 text-sm font-medium text-red-600">목록 조회 실패: {filtered.error}</p>
        ) : filtered.rows.length === 0 ? (
          <p className="mt-10 text-sm text-neutral-500">해당하는 문의가 없습니다.</p>
        ) : (
          <ul className="mt-6 space-y-3">
            {filtered.rows.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/admin/inquiries/${q.id}`}
                  className="hover:border-trust-500 block rounded-2xl border border-neutral-200 bg-white p-5 transition"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${INQUIRY_STATUS_TONE[q.status]}`}
                    >
                      {INQUIRY_STATUSES[q.status]}
                    </span>
                    <span className="text-xs text-neutral-500">{INQUIRY_CATEGORIES[q.category]}</span>
                    {!q.slack_notified_at && (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                        Slack 미전송
                      </span>
                    )}
                  </div>
                  <p className="mt-2 truncate font-semibold text-neutral-900">{q.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{q.body}</p>
                  <p className="tabular mt-2 text-xs text-neutral-400">
                    #{q.id} · {q.users?.nickname ?? "-"} · 접수 {formatKst(q.created_at)}
                    {q.answered_at ? ` · 답변 ${formatKst(q.answered_at)}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function FilterLink({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3.5 py-1.5 font-medium transition ${
        on ? "bg-neutral-900 text-white" : "border border-neutral-300 text-neutral-700 hover:border-neutral-500"
      }`}
    >
      {label}
    </Link>
  );
}
