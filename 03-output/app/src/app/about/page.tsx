import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { COMPANY_NAME, CONTACT_EMAIL } from "@/lib/site";

export const runtime = "edge";
export const metadata = {
  title: "서비스 소개",
  description:
    "Tester Match 는 Google Play 비공개 테스트(Closed Testing) 12명·14일 요건을 품앗이로 해결하는 한국 인디 안드로이드 개발자 커뮤니티입니다.",
};

export default async function AboutPage() {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold text-neutral-900">Tester Match 소개</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          서로의 앱을 테스트해주는 품앗이로, 혼자서는 넘기 힘든 Google Play 출시 관문을
          함께 통과하는 커뮤니티입니다.
        </p>

        <section className="mt-10 space-y-4 text-sm leading-7 text-neutral-700">
          <h2 className="text-xl font-bold text-neutral-900">왜 만들었나</h2>
          <p>
            2023년 11월부터 Google Play 는 신규 개인 개발자 계정에 앱을 정식 출시하기 전{" "}
            <strong>비공개 테스트(Closed Testing)에서 테스터 12명이 14일간 연속으로 참여</strong>
            해야 한다는 요건을 두고 있습니다. 좋은 앱을 만들고도 테스터 12명을 구하지 못해
            출시가 몇 주씩 밀리는 인디 개발자가 많습니다. 지인을 동원해도 14일을 채우기 전에
            이탈하면 처음부터 다시 시작해야 합니다.
          </p>
          <p>
            Tester Match 는 이 문제를 <strong>같은 처지의 개발자들끼리 서로 테스터가 되어주는
            품앗이</strong>로 풉니다. 내 앱을 등록하고, 다른 개발자의 앱을 테스트하면서 함께
            14일을 완주합니다.
          </p>

          <h2 className="pt-4 text-xl font-bold text-neutral-900">어떻게 동작하나</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <strong>앱 등록</strong> — Play Store URL 만 붙여넣으면 정보가 자동으로 채워집니다.
              공용 테스터 그룹 이메일을 Play Console 에 등록하면 준비 끝.
            </li>
            <li>
              <strong>테스트 참여</strong> — <Link href="/browse" className="text-trust-600 underline-offset-2 hover:underline">매칭 가능</Link> 목록에서
              다른 개발자의 앱에 참여합니다. 공용 그룹에 1회만 가입하면 모든 앱의 초대 링크를
              쓸 수 있습니다.
            </li>
            <li>
              <strong>14일 체크인</strong> — 매일 앱을 실행하고 체크인을 남깁니다. 체크인마다
              신뢰도가 +1 쌓이고, 개발자는 테스터 현황을 실시간으로 확인합니다.
            </li>
            <li>
              <strong>완주</strong> — 14일을 채우면 개발자는 정식 출시 신청 요건을 충족하고,
              테스터는 신뢰도와 크레딧 보상(예정)을 받습니다.
            </li>
          </ol>

          <h2 className="pt-4 text-xl font-bold text-neutral-900">신뢰를 만드는 장치</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>신뢰도 점수</strong> — 매일 체크인 +1 (최대 1,000점). 무단 이탈은 −10.
              점수는 닉네임 옆 ★로 상시 공개되어 성실한 테스터가 드러납니다.
              (<Link href="/stats" className="text-trust-600 underline-offset-2 hover:underline">활동 랭킹</Link> 참고)
            </li>
            <li>
              <strong>개발자 모니터링</strong> — 테스터별 설치 확인·플랫폼 출석·체크인 기록을
              한 화면에서 확인.
            </li>
            <li>
              <strong>공용 테스터 그룹</strong> — 그룹 하나로 모든 앱을 커버해 테스터 관리
              부담을 없앴습니다.
            </li>
          </ul>

          <h2 className="pt-4 text-xl font-bold text-neutral-900">운영 정보</h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>운영사: {COMPANY_NAME}</li>
            <li>
              문의: <a href={`mailto:${CONTACT_EMAIL}`} className="text-trust-600 underline-offset-2 hover:underline">{CONTACT_EMAIL}</a>
            </li>
            <li>
              <Link href="/policies/terms" className="text-trust-600 underline-offset-2 hover:underline">이용약관</Link>
              {" · "}
              <Link href="/policies/privacy" className="text-trust-600 underline-offset-2 hover:underline">개인정보처리방침</Link>
            </li>
          </ul>
        </section>

        <div className="mt-12 rounded-2xl border border-trust-500/30 bg-trust-50 p-6 text-center">
          <p className="text-sm font-semibold text-neutral-900">
            출시를 앞두고 테스터가 필요하신가요?
          </p>
          <Link
            href="/apps/new"
            className="mt-3 inline-block rounded-lg bg-trust-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-trust-700"
          >
            앱 등록하고 매칭 시작하기 →
          </Link>
        </div>
      </main>
    </>
  );
}
