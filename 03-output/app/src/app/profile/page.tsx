import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { ProfileForm } from "./profile-form";
import { WithdrawButton } from "./withdraw-button";
import { GroupStatusCard } from "./group-status-card";
import { formatKrw } from "@/lib/credits";

export const metadata = { title: "프로필" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/profile");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-ink-900">프로필</h1>
        <p className="mt-1 text-sm text-ink-700">
          닉네임은 게시판·매칭 화면에서 다른 사용자에게 표시됩니다.
        </p>

        <section className="mt-8 border border-ink-200 bg-white p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-600">이메일</dt>
              <dd className="mt-1 font-medium text-ink-900">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-600">신뢰 점수</dt>
              <dd className="mt-1 font-medium text-ink-900 tabular">{user.trustScore}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-600">크레딧 잔액</dt>
              <dd className="mt-1 font-medium text-ink-900 tabular">
                {formatKrw(user.balance)} ⓒ
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-600">권한</dt>
              <dd className="mt-1 font-medium text-ink-900">
                {user.role === "admin" ? "운영자" : "회원"}
              </dd>
            </div>
          </dl>
        </section>

        <GroupStatusCard />

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink-900">닉네임 변경</h2>
          <div className="mt-4">
            <ProfileForm
              initialNickname={user.nickname}
              initialKakaoNickname={user.kakaoNickname ?? ""}
            />
          </div>
        </section>

        <section className="mt-12 border border-danger-700 bg-danger-50 p-6">
          <h2 className="text-lg font-semibold text-ink-900">회원 탈퇴</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-700">
            탈퇴 시 본인 정보는 즉시 익명화되고, 진행 중인 매칭은 자동 옵트아웃됩니다. 보유 크레딧은 소멸하며 환불되지 않습니다.{" "}
            <Link href="/policies/privacy" className="underline hover:text-ink-900">
              자세히
            </Link>
          </p>
          <div className="mt-4">
            <WithdrawButton />
          </div>
        </section>
      </main>
    </>
  );
}
