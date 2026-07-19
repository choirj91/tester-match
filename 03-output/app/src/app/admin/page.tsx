import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import { NotifyGroupUpgradeButton } from "./notify-group-upgrade-button";

export const runtime = 'edge';

export const metadata = { title: "관리자" };

const TILES = [
  {
    href: "/admin/apps/import" as const,
    title: "앱 일괄 등록",
    desc: "이메일 + 앱 정보 JSON 으로 한 번에 여러 건 등록. 미가입 사용자는 placeholder 로 생성되고, 이후 같은 이메일로 Google 로그인 시 자동 매칭됩니다.",
  },
  {
    href: "/admin/stats" as const,
    title: "사용자 통계",
    desc: "앱 등록 순위, 테스트 참여 순위, 완주 순위 등 사용자별 활동 통계와 전체 현황을 확인합니다.",
  },
];

export default async function AdminHomePage() {
  const user = await requireAdminUser("/admin");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <header>
          <h1 className="text-2xl font-bold text-neutral-900">관리자</h1>
          <p className="mt-1 text-sm text-neutral-600">
            운영자 전용 도구. 일반 사용자는 접근할 수 없습니다.
          </p>
        </header>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {TILES.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="block rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:border-trust-600"
              >
                <h2 className="text-lg font-semibold text-neutral-900">{t.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t.desc}</p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <NotifyGroupUpgradeButton />
        </div>
      </main>
    </>
  );
}
