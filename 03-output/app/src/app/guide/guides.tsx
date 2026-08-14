import Link from "next/link";
import type { ReactNode } from "react";

export type Guide = {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  body: ReactNode;
};

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="text-trust-600 underline-offset-2 hover:underline">
    {children}
  </Link>
);

export const GUIDES: Guide[] = [
  {
    slug: "closed-testing-12-testers-14-days",
    title: "Google Play 비공개 테스트 완전 정복 — 테스터 12명 · 14일 요건",
    description:
      "신규 개인 개발자 계정이 정식 출시 전 반드시 통과해야 하는 Closed Testing 요건을 처음부터 끝까지 정리했습니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>요건이 정확히 뭔가요?</h2>
        <p>
          2023년 11월 13일 이후 생성된 <strong>개인(individual) 개발자 계정</strong>은 앱을
          프로덕션(정식 출시)으로 올리기 전, 비공개 테스트 트랙에서{" "}
          <strong>최소 12명의 테스터가 최근 14일간 연속으로 옵트인 상태</strong>를 유지해야
          합니다. 법인 계정에는 적용되지 않습니다.
        </p>
        <p>흔히 오해하는 포인트를 짚으면:</p>
        <ul>
          <li>
            <strong>14일은 &ldquo;누적&rdquo;이 아니라 &ldquo;연속&rdquo;</strong>입니다. 12명이
            채워진 시점부터 14일 카운트가 흐르고, 중간에 12명 아래로 떨어지면 다시 채워질
            때까지 진행이 멈춥니다.
          </li>
          <li>
            기준은 &ldquo;옵트인(테스터 등록) 유지&rdquo;입니다. 다만 Google 은 실제 사용
            신호도 심사에 참고하므로, 테스터가 실제로 앱을 설치·실행하는 것이 안전합니다.
          </li>
          <li>
            테스터는 <strong>Google 그룹 또는 이메일 목록</strong>으로 지정합니다. 그룹
            방식이 관리가 훨씬 쉽습니다.
          </li>
        </ul>
        <h2>전체 흐름</h2>
        <ol>
          <li>Play Console → 테스트 → <strong>비공개 테스트</strong> 트랙 생성, AAB 업로드</li>
          <li>테스터 탭에 Google 그룹 이메일 등록 (예: Tester Match 공용 그룹)</li>
          <li>생성된 초대 링크(웹/Android)를 테스터에게 공유</li>
          <li>테스터 12명이 옵트인 → 14일 유지</li>
          <li>14일 후 프로덕션 액세스 신청 → 설문 응답 → 승인 시 정식 출시 가능</li>
        </ol>
        <h2>가장 흔한 실패 원인</h2>
        <p>
          <strong>테스터 이탈</strong>입니다. 지인 12명을 겨우 모아도 7~10일차에 한두 명이
          옵트아웃하거나 기기를 바꾸면 카운트가 멈춥니다. 그래서 &ldquo;같은 처지의
          개발자끼리 서로 테스트해주는&rdquo; 품앗이가 효과적입니다 — 상대도 14일을 채워야
          하므로 이탈 유인이 적습니다. <A href="/browse">Tester Match 매칭 목록</A>에서 바로
          시작할 수 있습니다.
        </p>
      </>
    ),
  },
  {
    slug: "play-console-tester-group-setup",
    title: "Play Console 테스터 그룹 설정법 — 공용 그룹 하나로 끝내기",
    description:
      "테스터를 이메일로 한 명씩 추가하다 지친 분들을 위한 Google 그룹 기반 테스터 관리 가이드.",
    date: "2026-08-14",
    body: (
      <>
        <h2>이메일 목록 vs Google 그룹</h2>
        <p>
          Play Console 은 테스터 지정을 <strong>이메일 목록</strong>과{" "}
          <strong>Google 그룹</strong> 두 방식으로 지원합니다. 이메일 목록은 테스터가 늘 때마다
          Console 에 들어가 수정해야 하지만, 그룹 방식은{" "}
          <strong>그룹에 사람이 들어오면 자동으로 테스터 자격이 생깁니다</strong>. 운영 부담이
          10분의 1 이하로 줄어듭니다.
        </p>
        <h2>주의: 그룹 종류에 함정이 있습니다</h2>
        <p>
          실측 결과 Play Console 은 <code>@googlegroups.com</code> 으로 끝나는{" "}
          <strong>일반(consumer) Google 그룹만 안정적으로 인식</strong>합니다. Google
          Workspace 의 커스텀 도메인 그룹(예: testers@내도메인.com)은 공개 설정을 전부 열어도
          &ldquo;그룹이 존재하지 않거나 액세스 권한이 없습니다&rdquo; 오류가 나는 사례가
          많습니다. 그룹을 직접 만든다면 반드시 googlegroups.com 그룹으로 만드세요.
        </p>
        <h2>설정 절차</h2>
        <ol>
          <li>
            groups.google.com 에서 그룹 생성 — 설정에서 &ldquo;그룹 보기: 웹의 모든
            사용자&rdquo;, &ldquo;가입: 웹상의 모든 사용자가 가입 가능&rdquo;으로.
          </li>
          <li>Play Console → 테스트 → 비공개 테스트 → 테스터 탭 → 그룹 이메일 입력·저장</li>
          <li>테스터에게는 그룹 가입 페이지 링크 + 앱 초대 링크 두 개를 전달</li>
        </ol>
        <h2>더 쉬운 방법</h2>
        <p>
          Tester Match 에 앱을 등록하면 <strong>공용 테스터 그룹</strong>을 그대로 쓸 수
          있습니다. 커뮤니티 테스터들이 이미 이 그룹에 가입되어 있어서, Console 에 그룹
          이메일 한 줄만 등록하면 테스터 풀 전체가 연결됩니다.{" "}
          <A href="/apps/new">앱 등록하기</A>에서 그룹 이메일을 복사할 수 있습니다.
        </p>
      </>
    ),
  },
  {
    slug: "surviving-14-days",
    title: "14일 완주 전략 — 테스터 이탈 없이 카운트 채우는 법",
    description:
      "12명을 모으는 것보다 어려운 건 14일을 유지하는 것. 이탈을 줄이는 실전 노하우.",
    date: "2026-08-14",
    body: (
      <>
        <h2>이탈은 언제, 왜 일어나나</h2>
        <p>
          경험상 이탈은 3~5일차(잊어버림)와 10일차 전후(지루함)에 몰립니다. 테스터가 악의로
          나가는 경우는 드뭅니다 — 대부분 <strong>그냥 잊습니다</strong>. 그래서 완주 전략의
          핵심은 &ldquo;기억하게 만들기&rdquo;입니다.
        </p>
        <h2>개발자가 할 수 있는 것</h2>
        <ul>
          <li>
            <strong>여유 인원 확보</strong> — 정확히 12명이 아니라 15~18명을 모으세요. 한두
            명 이탈해도 카운트가 멈추지 않습니다.
          </li>
          <li>
            <strong>중간 소통</strong> — 7일차쯤 &ldquo;절반 왔습니다, 감사합니다&rdquo; 한
            마디가 이탈률을 눈에 띄게 줄입니다. Tester Match 는 댓글·테스터 요청 기능으로
            참여자에게 메시지를 보낼 수 있습니다.
          </li>
          <li>
            <strong>테스터 현황 모니터링</strong> — 설치 확인·출석·체크인이 끊긴 테스터를
            일찍 발견하면 대체 인원을 미리 구할 수 있습니다.
          </li>
        </ul>
        <h2>테스터로 참여할 때</h2>
        <ul>
          <li>
            <strong>매일 체크인</strong> — Tester Match 에서는 체크인마다 신뢰도가 +1
            쌓입니다 (<A href="/stats">활동 랭킹</A>에 반영). 앱을 잠깐이라도 실행하고
            체크인하는 습관이 서로의 출시를 지킵니다.
          </li>
          <li>
            <strong>중도 포기는 미리 알리기</strong> — 무단 이탈(−10)보다 옵트아웃(−3)이
            페널티가 훨씬 작습니다. 알려주면 개발자가 정원을 바로 채울 수 있기 때문입니다.
          </li>
          <li>
            <strong>기기 변경 주의</strong> — 테스트 중 기기나 Google 계정을 바꾸면 옵트인이
            끊길 수 있습니다.
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "production-access-after-14-days",
    title: "14일을 채운 다음 — 프로덕션 액세스 신청과 심사 대비",
    description:
      "카운트가 끝났다고 자동 출시가 아닙니다. 프로덕션 액세스 신청 설문과 심사에서 막히지 않는 법.",
    date: "2026-08-14",
    body: (
      <>
        <h2>14일 이후의 절차</h2>
        <p>
          14일 요건이 충족되면 Play Console 대시보드에 <strong>&ldquo;프로덕션 액세스
          신청&rdquo;</strong> 버튼이 활성화됩니다. 누르면 테스트 경험에 대한 설문이
          나옵니다 — 형식적인 것이 아니라 <strong>실제 심사 자료</strong>입니다.
        </p>
        <h2>설문 작성 팁</h2>
        <ul>
          <li>
            <strong>구체적인 피드백 사례를 쓰세요.</strong> &ldquo;테스터 의견으로 온보딩
            화면을 2단계에서 1단계로 줄였다&rdquo;처럼 테스트 → 개선의 연결이 드러나야
            합니다. Tester Match 의 댓글·게시판 피드백을 그대로 인용하면 좋습니다.
          </li>
          <li>
            <strong>수치를 넣으세요.</strong> 테스터 수, 발견한 버그 수, 수정한 항목 수.
          </li>
          <li>
            &ldquo;친구들이 테스트했고 문제 없었다&rdquo;류의 빈 답변은 반려 사유가 됩니다.
          </li>
        </ul>
        <h2>심사에서 자주 걸리는 것</h2>
        <ul>
          <li>개인정보처리방침 URL 누락 또는 접속 불가</li>
          <li>앱 내 기능과 스토어 등록정보(스크린샷·설명) 불일치</li>
          <li>로그인 필수 앱인데 심사용 테스트 계정 미제공</li>
          <li>데이터 보안 섹션(Data Safety) 미작성·부정확</li>
        </ul>
        <p>
          신청 후 심사는 보통 수일 이내지만 최대 7일 이상 걸리기도 합니다. 반려되면 사유를
          수정하고 재신청할 수 있으니 좌절하지 마세요.
        </p>
      </>
    ),
  },
  {
    slug: "indie-aso-basics",
    title: "출시 직후 초기 노출 만들기 — 인디 개발자를 위한 ASO 기초",
    description:
      "마케팅 예산 0원으로 시작하는 앱 스토어 최적화. 출시 첫 달에 해야 할 것들.",
    date: "2026-08-14",
    body: (
      <>
        <h2>출시가 끝이 아니라 시작</h2>
        <p>
          정식 출시 직후 앱은 검색 노출이 거의 없습니다. 초기 노출은{" "}
          <strong>스토어 등록정보의 완성도</strong>와 <strong>초기 사용 신호</strong>가
          만듭니다.
        </p>
        <h2>등록정보 체크리스트</h2>
        <ul>
          <li>
            <strong>제목 (30자)</strong> — 브랜드명 + 핵심 키워드 1개. 예:
            &ldquo;하루메모 — 3초 음성 메모&rdquo;
          </li>
          <li>
            <strong>간단한 설명 (80자)</strong> — 검색 가중치가 높은 자리. 사용자가 검색할
            법한 단어로.
          </li>
          <li>
            <strong>스크린샷 첫 2장</strong> — 설치 결정의 80%가 여기서. 기능 나열보다
            &ldquo;이 앱을 쓰면 무엇이 좋아지는지&rdquo; 한 문장 캡션.
          </li>
          <li>
            <strong>그래픽 이미지·아이콘</strong> — 경쟁 앱 10개와 나란히 놓고 눈에 띄는지
            확인.
          </li>
        </ul>
        <h2>초기 신호 만들기</h2>
        <ul>
          <li>
            비공개 테스트를 함께한 테스터들에게 출시 소식을 알리세요 — 첫 설치·첫 리뷰의
            자연스러운 출처입니다. (단, <strong>리뷰 대가 제공은 Google 정책 위반</strong>
            입니다. 부탁은 &ldquo;써보시고 솔직한 의견 남겨주세요&rdquo;까지.)
          </li>
          <li>디스콰이엇, 게릴라 마케팅 커뮤니티, 관련 서브레딧에 제작기를 공유하세요.</li>
          <li>
            출시 후 2주간은 크래시·ANR 지표를 매일 확인하세요 — 품질 지표가 나쁘면 노출이
            줄어듭니다.
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "trust-score-and-credits",
    title: "Tester Match 신뢰도·크레딧 시스템 안내",
    description:
      "체크인마다 쌓이는 신뢰도 점수와 크레딧이 어떻게 동작하는지, 어떻게 활용되는지 정리했습니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>신뢰도 점수 (★)</h2>
        <p>
          모든 회원은 50점으로 시작하고, 점수는 닉네임 옆에 ★로 상시 표시됩니다. 규칙은
          단순합니다:
        </p>
        <ul>
          <li>
            <strong>매일 체크인 +1</strong> — 참여 중인 각 테스트에서 하루 1회. 상한 1,000점.
          </li>
          <li>
            <strong>자진 옵트아웃 −3</strong> — 중도 포기를 미리 알리는 경우.
          </li>
          <li>
            <strong>무단 이탈 −10</strong> — 알리지 않고 사라지는 경우. 포기하더라도 알리는
            쪽이 항상 유리하게 설계했습니다.
          </li>
        </ul>
        <p>
          앱 등록 수·게시글 수 같은 &ldquo;양&rdquo;에는 점수를 주지 않습니다 — 어뷰징을
          막고, 오직 <strong>성실한 테스트 참여</strong>만 점수가 되게 하기 위해서입니다.
          현재 순위는 <A href="/stats">활동 랭킹</A>에서 볼 수 있습니다.
        </p>
        <h2>크레딧</h2>
        <p>
          크레딧은 1크레딧 = 1원 가치의 서비스 내 포인트입니다. 14일 완주 시 테스터에게
          800크레딧이 적립되며, 추후 급구(부스트) 등 유료 기능 결제에 사용할 수 있습니다.
        </p>
        <h2>랭킹 크레딧 보상 (예정)</h2>
        <p>
          성실한 참여가 더 확실하게 보상받도록, 활동 랭킹 상위·완주 실적에 따른 크레딧
          보상을 준비하고 있습니다. 지금 쌓이는 신뢰도·완주 기록이 모두 반영될 예정이니
          미리 참여해두세요.
        </p>
      </>
    ),
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
