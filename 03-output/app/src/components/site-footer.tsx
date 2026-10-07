import Link from "next/link";
import { BUSINESS } from "@/lib/site";

const POLICY_LINKS = [
  { href: "/about", label: "서비스 소개" },
  { href: "/policies/terms", label: "이용약관" },
  { href: "/policies/privacy", label: "개인정보처리방침" },
  { href: "/policies/refund", label: "환불 정책" },
  { href: "/policies/credits", label: "크레딧 정책" },
  { href: "/inquiries", label: "문의" },
] as const;

/**
 * 푸터 (Design C §5.15) — 결제 페이지를 포함한 모든 페이지에 렌더한다.
 * 통신판매업 신고번호는 신고 후 BUSINESS 에 추가하고 여기에 한 줄 더한다 (신고 전에는 표기하지 않는다).
 */
export function SiteFooter() {
  const items: ReadonlyArray<{ label: string; value: React.ReactNode; mono?: boolean }> = [
    { label: "상호", value: BUSINESS.name },
    { label: "대표자", value: BUSINESS.representative },
    { label: "사업자등록번호", value: BUSINESS.registrationNumber, mono: true },
    { label: "주소", value: BUSINESS.address },
    {
      label: "전화",
      value: <a href={`tel:${BUSINESS.phone.replaceAll("-", "")}`}>{BUSINESS.phone}</a>,
      mono: true,
    },
    { label: "이메일", value: <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> },
  ];

  return (
    <footer className="border-t border-ink-900 bg-white text-ink-900">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[18px] px-5 py-8">
        <nav aria-label="정책" className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
          {POLICY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="text-ink-900 no-underline hover:text-accent-600">
              {link.label}
            </Link>
          ))}
        </nav>
        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-x-6 gap-y-1.5 text-[12.5px] leading-relaxed">
          {items.map((item) => (
            <div key={item.label} className="flex gap-2">
              <dt className="flex-none text-ink-600">{item.label}</dt>
              <dd className={item.mono ? "m-0 font-mono tabular-nums" : "m-0"}>{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-1 text-[12.5px] text-ink-600">
          <p className="m-0">급구(유료 테스터)의 판매·환불 주체는 낰낰컴퍼니입니다.</p>
          <p className="m-0">크레딧은 보상으로만 지급되며 구매·양도·현금 환급이 불가능합니다.</p>
          <p className="m-0">Google Play 는 Google LLC 의 상표입니다.</p>
        </div>
      </div>
    </footer>
  );
}
