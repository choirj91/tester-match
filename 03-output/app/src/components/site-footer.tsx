import Link from "next/link";
import { COMPANY_NAME, CONTACT_EMAIL } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/about" className="text-neutral-600 hover:text-neutral-900">
            서비스 소개
          </Link>
          <Link href="/guide" className="text-neutral-600 hover:text-neutral-900">
            출시 가이드
          </Link>
          <Link href="/stats" className="text-neutral-600 hover:text-neutral-900">
            활동 랭킹
          </Link>
          <Link href="/policies/terms" className="text-neutral-600 hover:text-neutral-900">
            이용약관
          </Link>
          <Link href="/policies/privacy" className="text-neutral-600 hover:text-neutral-900">
            개인정보처리방침
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-neutral-600 hover:text-neutral-900">
            문의
          </a>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-neutral-400">
          {COMPANY_NAME} · Tester Match 는 Google Play 비공개 테스트 요건을 개발자 품앗이로
          해결하는 커뮤니티입니다. Google Play 는 Google LLC 의 상표입니다.
        </p>
      </div>
    </footer>
  );
}
