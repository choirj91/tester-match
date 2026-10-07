import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { Receipt, ReceiptDivider, ReceiptRow, ReceiptRows } from "@/components/ui/receipt";
import { EmptyState } from "@/components/ui/state";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CREDIT_TYPE_LABEL, formatKrw, getRedeemable } from "@/lib/credits";
import {
  PAID_SEAT_REWARD,
  REDEMPTION_MIN_CREDITS,
  REDEMPTION_UNIT_CREDITS,
} from "@/lib/paid-seats";
import { REWARD_CATALOG, type RewardKind } from "@/lib/rewards";
import { SEAT_MIN_CHECKIN_DAYS, SEAT_REWARD_HOLD_DAYS, SEAT_REWARD_SUMMARY } from "@/lib/seat-reward-rules";
import { CreditRulesSection } from "../rewards/credit-rules-section";
import { RedemptionForm } from "./redemption-form";

export const metadata = { title: "크레딧" };

const REDEMPTION_LABEL: Record<string, string> = {
  requested: "처리 대기",
  done: "발송 완료",
  rejected: "거절 (복구)",
};

const REDEMPTION_TONE: Record<string, BadgeTone> = {
  requested: "warning",
  done: "success",
  rejected: "danger",
};

const LINK = "text-ink-900 underline underline-offset-2 hover:text-accent-600";

export default async function CreditsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/credits");

  const supabase = createSupabaseAdminClient();
  const [{ data: rows }, redeemable, { data: pendingRewards }, { data: redemptions }] = await Promise.all([
    supabase
      .from("credits_ledger")
      .select("id, amount, balance_after, type, ref_type, ref_id, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    getRedeemable(supabase, user.id),
    supabase
      .from("seat_rewards")
      .select("amount, status")
      .eq("tester_user_id", user.id)
      .in("status", ["held", "disputed"]),
    supabase
      .from("credit_redemptions")
      .select("id, kind, amount, status, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const pendingTotal = (pendingRewards ?? []).reduce((sum, r) => sum + r.amount, 0);
  const disputedCount = (pendingRewards ?? []).filter((r) => r.status === "disputed").length;

  return (
    <>
      <SiteHeader user={user} />
      <main>
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 pt-14 pb-14">
          <header className="flex max-w-[760px] flex-col gap-3">
            <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">크레딧</h1>
            <p className="m-0 text-[15px] leading-[1.75] text-ink-700">
              크레딧은 유료 시트 테스트로만 적립됩니다 — {SEAT_REWARD_SUMMARY}. 개발자 확정 후 지급.{" "}
              <span className="font-mono tabular-nums">{REDEMPTION_MIN_CREDITS.toLocaleString("ko-KR")}</span>{" "}
              이상 모으면 기프티콘·네이버페이 포인트로 바꾸거나, 내 앱의 테스터 시트를 여는 데 쓸 수
              있습니다. 구매·양도·현금 환급은 안 됩니다.
            </p>
          </header>

          {pendingTotal > 0 && (
            <Notice kind="info" className="max-w-[760px]">
              <strong className="text-ink-900">
                확정 대기 <span className="font-mono tabular-nums">{formatKrw(pendingTotal)}</span> 크레딧
              </strong>{" "}
              — 개발자가 확인하면 바로, 응답이 없으면 완주 {SEAT_REWARD_HOLD_DAYS}일 뒤 자동 지급됩니다.
              {disputedCount > 0 && ` (이의 검토 중 ${disputedCount}건 — 운영팀이 증빙 확인 후 판정)`}
            </Notice>
          )}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] items-start gap-8">
            {/* 잔액 — 영수증 */}
            <Receipt
              title="보유 크레딧"
              footer={
                <>
                  내 앱 테스터 시트 열기에 사용 가능 ·{" "}
                  <Link href="/paid-testers" className={LINK}>
                    내 앱에 테스터 투입
                  </Link>
                </>
              }
            >
              <p className="m-0 font-mono text-[40px] leading-none font-medium text-ink-900 tabular-nums">
                {formatKrw(user.balance)} <span className="font-sans text-lg font-semibold">크레딧</span>
              </p>
              <ReceiptDivider />
              <ReceiptRows>
                <ReceiptRow label="보상 교환 가능" value={`${formatKrw(redeemable)} 크레딧`} strong />
              </ReceiptRows>
              <p className="m-0 font-mono text-xs text-ink-600">유료 시트 완주 적립분만 해당</p>
            </Receipt>

            {/* 보상 교환 */}
            <section aria-labelledby="redeem-title" className="flex flex-col gap-4 border-t-[1.5px] border-ink-900 pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="redeem-title" className="m-0 font-display text-h3 font-semibold text-ink-900">
                  보상 교환 — 기프티콘 · 네이버페이 포인트
                </h2>
                <Link href="/rewards" className={`inline-flex min-h-11 items-center gap-1 text-[13px] ${LINK}`}>
                  보상 안내
                  <ArrowRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </div>
              <RedemptionForm
                redeemable={redeemable}
                minCredits={REDEMPTION_MIN_CREDITS}
                unitCredits={REDEMPTION_UNIT_CREDITS}
              />
              {redemptions && redemptions.length > 0 && (
                <ul className="m-0 list-none border-t border-ink-900 p-0 text-sm">
                  {redemptions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 border-b border-ink-200 py-2.5">
                      <span className="text-ink-900">
                        {REWARD_CATALOG[r.kind as RewardKind]?.label ?? r.kind}{" "}
                        <span className="font-mono tabular-nums">{formatKrw(r.amount)}</span> 크레딧 ·{" "}
                        <span className="font-mono text-ink-600 tabular-nums">
                          {new Date(r.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </span>
                      <Badge tone={REDEMPTION_TONE[r.status] ?? "outline"}>
                        {REDEMPTION_LABEL[r.status] ?? r.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* 원장 */}
          <section aria-labelledby="ledger-title" className="flex flex-col gap-4">
            <h2
              id="ledger-title"
              className="m-0 font-display text-h2 font-semibold tracking-[-0.01em] text-ink-900"
            >
              내역
            </h2>
            {rows && rows.length > 0 ? (
              <ul className="m-0 list-none border-t border-ink-900 p-0">
                {rows.map((r) => {
                  const isPositive = r.amount > 0;
                  return (
                    <li
                      key={r.id}
                      className="flex flex-col gap-1 border-b border-ink-200 py-4 sm:flex-row sm:items-center sm:gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-medium text-ink-900">
                          {CREDIT_TYPE_LABEL[r.type] ?? r.type}
                          {r.description && <span className="ml-2 text-xs text-ink-600">· {r.description}</span>}
                        </p>
                        <p className="m-0 mt-0.5 font-mono text-xs text-ink-600 tabular-nums">
                          {new Date(r.created_at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex items-baseline gap-3 font-mono tabular-nums sm:flex-col sm:items-end sm:gap-0.5">
                        <span
                          className={`text-base font-medium ${isPositive ? "text-success-700" : "text-danger-700"}`}
                        >
                          {isPositive ? "+" : ""}
                          {formatKrw(r.amount)}
                        </span>
                        <span className="text-xs text-ink-600">잔액 {formatKrw(r.balance_after)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="아직 적립·사용 내역이 없습니다."
                description={
                  <>
                    <Link href="/browse" className={LINK}>
                      시트가 열린 앱
                    </Link>
                    에 참여해 {SEAT_MIN_CHECKIN_DAYS}일 이상 출석하면 최대{" "}
                    <span className="font-mono tabular-nums">{PAID_SEAT_REWARD}</span> 크레딧이 적립됩니다.
                  </>
                }
              />
            )}
          </section>
        </div>

        <CreditRulesSection />
      </main>
    </>
  );
}
