import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { PlayGroupJoinPrompt } from "@/components/play-group-join-prompt";
import { PLAY_GROUP_EMAIL } from "@/lib/tester-group";
import { AppForm } from "./app-form";

export const metadata = { title: "앱 등록" };

export default async function NewAppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login?next=/apps/new");

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href="/apps"
          className="text-sm text-ink-600 hover:text-ink-900"
        >
          ← 내 앱
        </Link>
        <h1 className="mt-4 text-2xl font-bold text-ink-900">앱 등록</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          Google Play Closed Testing 12명 매칭을 시작합니다. 등록 즉시 매칭 큐에 진입합니다.
        </p>

        <div className="mt-6 border border-warning-700 bg-warning-50 p-4">
          <p className="text-sm font-semibold text-warning-700">
            먼저 공용 테스터 그룹에 가입해주세요 (최초 1회)
          </p>
          <p className="mt-1 text-xs leading-relaxed text-warning-700">
            품앗이 매칭은 서로의 앱을 테스트하는 구조입니다. 다른 앱 테스트에
            참여하려면 <strong>{PLAY_GROUP_EMAIL}</strong> 그룹 가입이 필요합니다.
            Google Play 와 동일한 계정으로 가입해주세요. 이미 가입했다면 무시하셔도
            됩니다.
          </p>
          <PlayGroupJoinPrompt compact />
        </div>

        <div className="mt-8">
          <AppForm initialNickname={user.nickname} email={user.email} />
        </div>
      </main>
    </>
  );
}
