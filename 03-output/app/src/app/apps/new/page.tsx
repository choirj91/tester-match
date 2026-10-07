import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { PlayGroupJoinPrompt } from "@/components/play-group-join-prompt";
import { Notice } from "@/components/ui/notice";
import { PLAY_CLOSED_TEST_TESTERS } from "@/lib/site";
import { PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { AppForm } from "./app-form";

export const metadata = { title: "앱 등록" };

export default async function NewAppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/apps/new");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-5 pt-12 pb-[88px]">
        <Link
          href="/apps"
          className="inline-flex min-h-11 items-center text-sm text-ink-700 hover:text-accent-600"
        >
          ← 내 앱
        </Link>
        <h1 className="mt-2 font-display text-h1 font-semibold text-ink-900">앱 등록</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-700">
          Google Play Closed Testing <span className="tabular">{PLAY_CLOSED_TEST_TESTERS}</span>명 매칭을 시작합니다. 등록 즉시 매칭 큐에 진입합니다.
        </p>

        <Notice kind="caution" title="먼저 공용 테스터 그룹에 가입해주세요 (최초 1회)" className="mt-6">
          <p>
            품앗이 매칭은 서로의 앱을 테스트하는 구조입니다. 다른 앱 테스트에
            참여하려면 <strong className="break-all">{PLAY_GROUP_EMAIL}</strong> 그룹 가입이 필요합니다.
            Google Play 와 동일한 계정으로 가입해주세요. 이미 가입했다면 무시하셔도
            됩니다.
          </p>
          <PlayGroupJoinPrompt compact />
        </Notice>

        <div className="mt-8">
          <AppForm initialNickname={user.nickname} email={user.email} />
        </div>
      </main>
    </>
  );
}
