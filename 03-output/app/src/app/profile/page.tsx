import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { WithdrawButton } from "./withdraw-button";
import { GroupStatusCard } from "./group-status-card";
import { ReferralCard } from "./referral-card";
import { formatKrw } from "@/lib/credits";
import {
  REFERRAL_CAP_PER_WINDOW,
  REFERRAL_CAP_WINDOW_DAYS,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_TRUST_DELTA,
  getReferralStats,
  referralLink,
} from "@/lib/referrals";
import { SITE_URL } from "@/lib/site";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "프로필" };

const SECTION = "flex flex-col gap-4 border-t border-ink-900 pt-6";
const H2 = "m-0 font-display text-h3 font-semibold text-ink-900";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/profile");
  const referralStats = await getReferralStats(createSupabaseAdminClient(), user.id);

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto flex max-w-[760px] flex-col gap-10 px-5 pt-12 pb-16">
        <header className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-h1 font-semibold text-ink-900">프로필</h1>
          <p className="m-0 text-[15px] text-ink-700">닉네임은 게시판·매칭 화면에서 다른 사용자에게 표시됩니다.</p>
        </header>

        <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] border-t-[1.5px] border-ink-900">
          <div className="flex flex-col gap-1 border-b border-ink-200 py-4 pr-4">
            <dt className="text-xs text-ink-600">이메일</dt>
            <dd className="m-0 font-medium break-all text-ink-900">{user.email}</dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-ink-200 py-4 pr-4">
            <dt className="text-xs text-ink-600">신뢰 점수</dt>
            <dd className="m-0 font-mono font-medium text-ink-900 tabular-nums">{user.trustScore}</dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-ink-200 py-4 pr-4">
            <dt className="text-xs text-ink-600">크레딧 잔액</dt>
            <dd className="m-0 font-medium text-ink-900">
              <span className="font-mono tabular-nums">{formatKrw(user.balance)}</span> 크레딧
            </dd>
          </div>
          <div className="flex flex-col gap-1 border-b border-ink-200 py-4 pr-4">
            <dt className="text-xs text-ink-600">권한</dt>
            <dd className="m-0 font-medium text-ink-900">{user.role === "admin" ? "운영자" : "회원"}</dd>
          </div>
        </dl>

        <GroupStatusCard />

        <ReferralCard
          link={referralLink(SITE_URL, user.id)}
          stats={referralStats}
          trustDelta={REFERRAL_TRUST_DELTA}
          linkDays={REFERRAL_COOKIE_MAX_AGE_SECONDS / (24 * 60 * 60)}
          capPerWindow={REFERRAL_CAP_PER_WINDOW}
          capWindowDays={REFERRAL_CAP_WINDOW_DAYS}
        />

        <section aria-labelledby="nickname-title" className={SECTION}>
          <h2 id="nickname-title" className={H2}>
            닉네임 변경
          </h2>
          <ProfileForm initialNickname={user.nickname} initialKakaoNickname={user.kakaoNickname ?? ""} />
        </section>

        <section aria-labelledby="withdraw-title" className={`${SECTION} mt-6`}>
          <h2 id="withdraw-title" className={H2}>
            회원 탈퇴
          </h2>
          <p className="m-0 text-[15px] leading-relaxed text-ink-700">
            탈퇴 시 본인 정보는 즉시 익명화되고, 진행 중인 매칭은 자동 옵트아웃됩니다. 보유 크레딧은 소멸하며 환불되지 않습니다.{" "}
            <Link href="/policies/privacy" className="text-ink-900 underline underline-offset-2 hover:text-accent-600">
              자세히
            </Link>
          </p>
          <div>
            <WithdrawButton />
          </div>
        </section>
      </main>
    </>
  );
}
