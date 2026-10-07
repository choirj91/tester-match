import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { title: "정책 안내" };

const ITEMS = [
  {
    href: "/policies/terms" as const,
    title: "이용약관",
    desc: "서비스 이용 시 회사와 회원 간 권리·의무·책임 사항.",
  },
  {
    href: "/policies/privacy" as const,
    title: "개인정보처리방침",
    desc: "수집·이용·보유 기간·위탁 처리·회원 권리 안내.",
  },
  {
    href: "/policies/refund" as const,
    title: "환불 정책",
    desc: "유료 테스터 시트 결제의 환불 기준과 처리 절차.",
  },
  {
    href: "/policies/credits" as const,
    title: "크레딧 운영 정책",
    desc: "보상 적립·교환(기프티콘·네이버페이 포인트)·만료·페널티 등 크레딧 운영 규정. 구매·양도·현금 환급 불가.",
  },
];

export default async function PoliciesIndex() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-ink-900">정책 안내</h1>
        <p className="mt-2 text-sm text-ink-700">
          낰낰컴퍼니가 운영하는 Tester Match 의 이용 조건·개인정보 처리·환불·크레딧 운영 기준입니다. 변경 시
          시행 7일 전에 게시판 공지로 안내합니다.
        </p>

        <ul className="mt-8 space-y-3">
          {ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between border border-ink-200 bg-white p-5 transition hover:border-ink-900"
              >
                <div>
                  <h2 className="text-lg font-semibold text-ink-900">{item.title}</h2>
                  <p className="mt-1 text-sm text-ink-700">{item.desc}</p>
                </div>
                <span className="text-ink-900">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
