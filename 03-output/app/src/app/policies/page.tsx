import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";

export const runtime = 'edge';

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
    desc: "크레딧 충전 / Boost 결제 환불 기준과 처리 절차.",
  },
  {
    href: "/policies/credits" as const,
    title: "크레딧 운영 정책",
    desc: "적립·사용·만료·페널티 등 크레딧 운영 규정.",
  },
];

export default async function PoliciesIndex() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-neutral-900">정책 안내</h1>
        <p className="mt-2 text-sm text-neutral-600">
          모든 문서는 자체 초안 v0.1 이며, 정식 출시 전 변호사 검토 후 v1.0 시행 예정.
        </p>

        <ul className="mt-8 space-y-3">
          {ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-trust-600"
              >
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">{item.title}</h2>
                  <p className="mt-1 text-sm text-neutral-600">{item.desc}</p>
                </div>
                <span className="text-trust-600">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
