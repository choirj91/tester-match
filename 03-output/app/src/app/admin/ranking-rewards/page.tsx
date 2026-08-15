import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { requireAdminUser } from "@/lib/admin";
import {
  REWARD_MONTHLY_BUDGET,
  REWARD_START_MONTH,
  REWARD_TABLE,
  RANK1_MIN_COMPLETED,
  MIN_TRUST,
} from "@/lib/ranking-rewards";
import { RewardPanel } from "./reward-panel";

export const runtime = "edge";

export const metadata = { title: "월간 랭킹 보상" };

export default async function RankingRewardsAdminPage() {
  const user = await requireAdminUser("/admin/ranking-rewards");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/admin" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← 관리자
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">월간 랭킹 보상</h1>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          지난달(KST) 완주 랭킹 1~3위에 {REWARD_TABLE.map((v) => v.toLocaleString()).join(" / ")}{" "}
          크레딧 지급. 월 예산 {REWARD_MONTHLY_BUDGET.toLocaleString()} 크레딧, 첫 대상{" "}
          {REWARD_START_MONTH.slice(0, 7)}월분. 1위 요건 완주 {RANK1_MIN_COMPLETED}회 이상,
          공통 자격 신뢰도 {MIN_TRUST} 이상·자기 앱 완주 제외. 정책:{" "}
          <code className="text-xs">03-output/policy/ranking-rewards.md</code>
        </p>

        <RewardPanel />
      </main>
    </>
  );
}
