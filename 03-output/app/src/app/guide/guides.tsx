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

const Img = ({ src, alt }: { src: string; alt: string }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} className="my-6 w-full rounded-xl border border-neutral-200 bg-white" loading="lazy" />
);

const Tip = ({ children }: { children: ReactNode }) => (
  <div className="my-5 rounded-xl border border-trust-500/30 bg-trust-50 px-4 py-3 text-[13px] leading-6">
    {children}
  </div>
);

export const GUIDES: Guide[] = [
  {
    slug: "closed-testing-12-testers-14-days",
    title: "구글 플레이 비공개 테스트, 처음이라면 — 12명 · 14일 요건 A to Z",
    description:
      "앱은 다 만들었는데 '테스터 12명이 14일간'이라는 벽에 막히셨나요? 요건이 정확히 무엇인지, 어디서부터 시작하면 되는지 처음 겪는 분 기준으로 정리했습니다.",
    date: "2026-08-14",
    body: (
      <>
        <p>
          몇 달 동안 만든 앱을 드디어 올리려고 Play Console 을 열었는데, &ldquo;프로덕션
          트랙&rdquo;이 잠겨 있어서 당황하셨다면 — 정상입니다. 저희도 똑같이 겪었습니다.
          이 글 하나로 요건의 정확한 의미와 전체 흐름을 잡아보세요.
        </p>
        <h2>내 계정도 해당되나요?</h2>
        <p>
          <strong>2023년 11월 13일 이후에 만든 개인(individual) 개발자 계정</strong>이라면
          해당됩니다. 법인 계정은 면제입니다. 원래는 &ldquo;테스터 20명&rdquo;이었는데,
          부담이 크다는 피드백이 이어지면서 2024년 12월부터 <strong>12명으로 완화</strong>
          됐습니다. 그래도 인디 개발자에겐 여전히 만만치 않은 숫자죠.
        </p>
        <h2>요건을 한 문장으로</h2>
        <p>
          <strong>&ldquo;비공개 테스트 트랙에서 12명 이상의 테스터가, 최근 14일 동안
          연속으로 옵트인(참여) 상태를 유지해야 한다.&rdquo;</strong> 이게 전부인데, 함정이
          단어 하나에 있습니다 — <strong>연속</strong>.
        </p>
        <Img src="/guide/flow-overview.svg" alt="비공개 테스트부터 정식 출시까지 5단계 흐름도" />
        <ul>
          <li>
            12명이 채워진 시점부터 14일이 흐릅니다. 중간에 한 명이라도 빠져 11명이 되면{" "}
            <strong>카운트가 멈춥니다</strong>.
          </li>
          <li>
            Google 공식 FAQ 기준, <strong>&ldquo;14일 미만으로 참여했다가 취소한 뒤 다시
            참여한 테스터&rdquo;는 집계에 포함되지 않습니다.</strong> 나갔다 들어오면 그
            사람은 처음부터 다시입니다.
          </li>
          <li>
            형식 요건은 &ldquo;옵트인 유지&rdquo;지만, 프로덕션 심사에서 테스터 참여도를
            묻기 때문에 <strong>실제로 설치·실행까지 하는 것</strong>이 안전합니다.
          </li>
        </ul>
        <h2>시작 순서 (이 순서대로만 하면 됩니다)</h2>
        <ol>
          <li>
            Play Console → 테스트 → <strong>비공개 테스트</strong> → 트랙 만들기 → AAB
            업로드. 이때 스토어 등록정보(설명·스크린샷·개인정보처리방침 URL)도 요구되고,{" "}
            <strong>비공개 테스트도 Google 심사를 거칩니다</strong> (보통 며칠).
          </li>
          <li>
            테스터 탭에서 <strong>Google 그룹</strong> 등록 —{" "}
            <A href="/guide/play-console-tester-group-setup">그룹 설정 가이드</A> 참고
          </li>
          <li>초대 링크를 테스터들에게 공유</li>
          <li>12명 유지하며 14일 — <A href="/guide/surviving-14-days">완주 전략</A></li>
          <li>
            프로덕션 액세스 신청 —{" "}
            <A href="/guide/production-access-after-14-days">설문 작성법</A>
          </li>
        </ol>
        <h2>테스터 12명은 어디서 구하나요?</h2>
        <p>
          가족·지인을 동원하는 게 첫 번째 방법이지만, 14일을 못 채우고 이탈하는 경우가
          정말 많습니다 (악의가 아니라 그냥 잊습니다). 유료 대행 서비스도 있지만 회당 몇만
          원씩 듭니다. 세 번째 길이 <strong>같은 처지의 개발자끼리 서로 테스터가 되어주는
          품앗이</strong>입니다 — 상대도 14일이 필요하니 이탈 유인이 적고, 개발자의
          시선으로 피드백까지 받을 수 있습니다. <A href="/browse">지금 매칭 중인 앱 보기</A>
        </p>
      </>
    ),
  },
  {
    slug: "play-console-tester-group-setup",
    title: "테스터 그룹 설정, 5분 만에 끝내기 — 이메일 목록 말고 Google 그룹",
    description:
      "테스터가 바뀔 때마다 Play Console 에 들어가 이메일을 고치고 계신가요? Google 그룹 하나면 그럴 필요가 없습니다. 함정(Workspace 그룹)까지 짚어드립니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>왜 그룹 방식인가</h2>
        <p>
          Play Console 의 테스터 지정은 <strong>이메일 목록</strong>과{" "}
          <strong>Google 그룹</strong> 두 가지입니다. 이메일 목록은 테스터가 추가될 때마다
          Console 을 열어 수정·저장해야 하고, 목록 인원 제한도 있습니다. 그룹 방식은{" "}
          <strong>그룹에 사람이 들어오면 자동으로 테스터 자격이 생기고 인원 제한도
          없습니다</strong>. 처음 5분만 투자하면 이후 관리가 0에 수렴합니다.
        </p>
        <Img src="/guide/console-testers-tab.svg" alt="Play Console 테스터 탭에서 Google 그룹스를 선택하고 그룹 이메일을 입력하는 화면 구성" />
        <h2>설정 절차</h2>
        <ol>
          <li>
            <strong>그룹 만들기</strong> — groups.google.com → 그룹 만들기. 설정에서
            &ldquo;그룹 보기: 웹의 모든 사용자&rdquo;, &ldquo;가입할 수 있는 사용자: 웹상의
            모든 사용자&rdquo;로 열어주세요. (닫혀 있으면 테스터가 가입 버튼을 못 봅니다)
          </li>
          <li>
            <strong>Console 에 등록</strong> — 테스트 → 비공개 테스트 → 테스터 탭 →
            &ldquo;Google 그룹스&rdquo; 선택 → 그룹 이메일 입력 → 저장
          </li>
          <li>
            <strong>테스터에게 두 가지 전달</strong> — ① 그룹 가입 페이지 링크 ② 앱 초대
            링크(웹/Android). 순서는 그룹 가입이 먼저입니다.
          </li>
        </ol>
        <h2>⚠️ 가장 큰 함정: 그룹의 &ldquo;종류&rdquo;</h2>
        <p>
          Play Console 은 <code>@googlegroups.com</code> 으로 끝나는{" "}
          <strong>일반(consumer) 그룹만 안정적으로 인식</strong>합니다. Google Workspace 의
          커스텀 도메인 그룹(testers@내도메인.com)은 공개 설정을 전부 열어도 &ldquo;이
          Google 그룹이 존재하지 않거나 액세스 권한이 없습니다&rdquo;라며 거부되는 사례가
          많습니다. 저희도 이걸로 3일을 날렸습니다. <strong>처음부터 googlegroups.com
          그룹으로 만드세요.</strong>
        </p>
        <h2>테스터 쪽에서 안 될 때 (문의 1위)</h2>
        <Img src="/guide/group-troubleshoot.svg" alt="초대 링크가 안 열릴 때 확인할 5단계 체크리스트" />
        <p>
          특히 3번 — 그룹 초대 메일을 받고 수락하지 않은 &ldquo;대기(Pending)&rdquo; 상태는
          회원이 아닙니다. 그리고 4번 — 기기에 Google 계정이 여러 개면{" "}
          <strong>그룹 가입 계정과 Play 스토어 계정이 달라서</strong> 안 되는 경우가 가장
          흔합니다.
        </p>
        <Tip>
          💡 Tester Match 에 앱을 등록하면 <strong>공용 테스터 그룹</strong>을 그대로 쓸 수
          있습니다. 커뮤니티 테스터들이 이미 가입돼 있어 Console 에 이메일 한 줄만 넣으면
          끝. <A href="/apps/new">앱 등록에서 그룹 이메일 복사하기</A>
        </Tip>
      </>
    ),
  },
  {
    slug: "surviving-14-days",
    title: "14일 완주 전략 — 카운트가 멈추는 이유와 막는 법",
    description:
      "12명 모으기는 성공했는데 8일차에 카운트가 멈췄다면? 이탈이 언제 왜 생기는지, 개발자와 테스터가 각각 무엇을 하면 되는지 실전 기준으로 정리했습니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>카운트가 흐르는 정확한 방식</h2>
        <Img src="/guide/timeline-14days.svg" alt="12명 유지 시 14일 연속 통과, 이탈 시 카운트 정지 후 복구되는 타임라인" />
        <p>
          그림처럼 <strong>12명이 유지되는 동안만 시간이 흐릅니다</strong>. 8일차에 한 명이
          나가면 11명인 기간은 통째로 버려지고, 12명이 복구된 뒤에 이어집니다. 더 아픈 건
          공식 FAQ 의 이 문장입니다 — &ldquo;14일 미만으로 테스트를 진행한 후 참여를 취소한
          테스터는 포함되지 않습니다.&rdquo; 나간 사람이 돌아와도 그 사람 몫은 리셋이라는
          뜻입니다. 그래서 <strong>이탈자를 되돌리기보다 새 테스터를 넣는 게 빠릅니다</strong>.
        </p>
        <h2>이탈은 언제 생기나</h2>
        <p>
          경험상 두 번 몰립니다. <strong>3~5일차</strong>(신선함이 떨어지고 잊어버림)와{" "}
          <strong>10일차 전후</strong>(다 끝난 줄 알고 앱 삭제). 악의적인 이탈은 거의
          없습니다 — 그래서 대응책도 &ldquo;감시&rdquo;가 아니라 &ldquo;기억하게
          만들기&rdquo;입니다.
        </p>
        <h2>개발자가 할 일 3가지</h2>
        <ul>
          <li>
            <strong>15~18명 확보</strong> — 정확히 12명으로 시작하면 한 명 이탈에 전체가
            멈춥니다. 여유 인원이 최고의 보험입니다.
          </li>
          <li>
            <strong>7일차 중간 인사</strong> — &ldquo;절반 왔습니다, 감사합니다!&rdquo; 한
            마디가 이탈률을 크게 줄입니다. Tester Match 는 앱 페이지 댓글과 테스터 요청
            기능으로 참여자 전체에게 알릴 수 있습니다.
          </li>
          <li>
            <strong>이상 신호 조기 발견</strong> — 설치 확인이 안 됐거나 체크인이 끊긴
            테스터를 앱 관리 화면의 테스터 현황에서 확인하고, 위험해 보이면 대체 인원을
            미리 구하세요.
          </li>
        </ul>
        <h2>테스터로 참여 중이라면</h2>
        <ul>
          <li>
            <strong>매일 체크인</strong> — 앱을 잠깐이라도 실행하고 체크인을 남기세요.
            Tester Match 에선 체크인마다 신뢰도 +1이 쌓입니다 (<A href="/stats">활동 랭킹</A>).
          </li>
          <li>
            <strong>그만둘 땐 옵트아웃 버튼으로</strong> — 무단 이탈(−10)과 달리
            옵트아웃(−3)은 페널티가 작습니다. 알려주면 개발자가 정원을 바로 채워서 피해가
            최소화되기 때문입니다.
          </li>
          <li>
            <strong>기기·계정 변경 금지</strong> — 테스트 중 Google 계정을 바꾸거나 기기를
            초기화하면 옵트인이 끊어질 수 있습니다. 14일만 참아주세요.
          </li>
        </ul>
      </>
    ),
  },
  {
    slug: "production-access-after-14-days",
    title: "프로덕션 액세스 신청 — 설문 3파트 작성법과 심사에서 떨어지는 이유",
    description:
      "14일을 채우면 나오는 설문, 대충 쓰면 거부됩니다. 실제 설문 구성(3파트)과 파트별 작성 요령, 공식 문서 기준 거부 사유를 정리했습니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>14일이 끝나면 생기는 일</h2>
        <p>
          요건이 충족되면 Play Console 대시보드에 <strong>&ldquo;프로덕션 액세스
          신청&rdquo;</strong> 버튼이 활성화됩니다. 누르면 설문이 시작되는데 — 이게 형식적인
          절차가 아니라 <strong>실제 심사 자료</strong>입니다. 공식 문서 기준
          &ldquo;불완전한 답변 제출&rdquo;은 그 자체로 거부 사유입니다.
        </p>
        <Img src="/guide/survey-3parts.svg" alt="프로덕션 액세스 설문의 3파트 구성 — 비공개 테스트 정보, 앱 정보, 출시 준비 상태" />
        <h2>파트별 작성 요령</h2>
        <ul>
          <li>
            <strong>파트 1 (비공개 테스트)</strong> — 테스터 모집 경위·참여도·받은 피드백을
            묻습니다. 핵심은 <strong>구체성</strong>: &ldquo;커뮤니티에서 테스터 14명을
            모집했고, 온보딩이 헷갈린다는 의견 3건을 받아 가입 절차를 2단계에서 1단계로
            줄였다&rdquo;처럼 쓰세요. Tester Match 댓글·게시판에 남은 피드백을 그대로
            인용하면 좋은 재료가 됩니다.
          </li>
          <li>
            <strong>파트 2 (앱 정보)</strong> — 주요 사용자층, 앱의 가치·차별점, 첫해 예상
            설치 수(범위 선택)를 묻습니다. 예상 설치 수는 부풀리지 말고 현실적인 범위를
            고르세요 — 심사관이 보는 건 숫자의 크기가 아니라 답변의 일관성입니다.
          </li>
          <li>
            <strong>파트 3 (출시 준비)</strong> — 테스트에서 배운 것으로 무엇을 바꿨는지,
            준비됐다고 판단한 근거를 묻습니다. <strong>&ldquo;피드백 → 개선&rdquo;의 연결
            고리</strong>가 구체적으로 드러나야 합니다. &ldquo;문제 없었음&rdquo;류의 답은
            테스트를 안 했다는 자백처럼 읽힙니다.
          </li>
        </ul>
        <h2>공식 문서 기준 거부 사유</h2>
        <ul>
          <li>테스터 12명 미만 (요건 미충족 상태로 신청)</li>
          <li>테스터의 지속적 참여 부족 (옵트인만 하고 사용 흔적 없음)</li>
          <li>불완전한 설문 답변</li>
          <li>테스트에서 드러난 앱 품질 문제 미해결</li>
        </ul>
        <h2>심사 기간과 그 이후</h2>
        <p>
          심사는 <strong>보통 7일 이내</strong>이며 결과는 이메일로 옵니다. 거부되더라도
          사유를 보완해 재신청할 수 있으니 좌절할 필요 없습니다. 승인 후에도 비공개
          테스트를 유지하면서 버그를 잡고, 프로덕션 출시 심사(별도)까지 마치면 드디어
          스토어에 공개됩니다. 다음 글:{" "}
          <A href="/guide/indie-aso-basics">출시 직후 초기 노출 만들기</A>
        </p>
      </>
    ),
  },
  {
    slug: "indie-aso-basics",
    title: "출시했는데 아무도 안 옵니다 — 예산 0원 인디 ASO 기초",
    description:
      "정식 출시 직후 검색 노출은 거의 0입니다. 스토어 등록정보를 고치는 것만으로 만들 수 있는 초기 노출과, 절대 하면 안 되는 것(리뷰 대가)을 정리했습니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>출시 첫 주의 현실</h2>
        <p>
          프로덕션 승인의 기쁨도 잠시, 대부분의 인디 앱은 출시 첫 주 자연 유입이 한 자릿수
          입니다. 광고 예산이 없다면 초기 노출은 두 가지가 만듭니다 —{" "}
          <strong>스토어 등록정보의 완성도</strong>와 <strong>초기 사용 신호</strong>.
        </p>
        <h2>등록정보 체크리스트 (오늘 고칠 수 있는 것)</h2>
        <ul>
          <li>
            <strong>앱 이름 (30자)</strong> — 브랜드명 + 검색될 키워드 1개.
            &ldquo;하루메모 — 3초 음성 메모&rdquo;처럼. 키워드 없이 브랜드명만 쓰는 게
            초보 실수 1위입니다.
          </li>
          <li>
            <strong>간단한 설명 (80자)</strong> — 검색 가중치가 높은 자리입니다. 기능
            나열보다 사용자가 실제로 검색할 문구(&ldquo;음성으로 메모&rdquo;,
            &ldquo;가계부 자동&rdquo;)를 넣으세요.
          </li>
          <li>
            <strong>스크린샷 첫 2장</strong> — 설치 결정의 대부분이 여기서 납니다. UI
            캡처만 올리지 말고 &ldquo;무엇이 좋아지는지&rdquo; 한 줄 캡션을 얹으세요.
          </li>
          <li>
            <strong>아이콘</strong> — 경쟁 앱 10개와 검색 결과에 나란히 놓고 본인 아이콘이
            눈에 띄는지 확인하세요.
          </li>
        </ul>
        <h2>초기 신호 만들기</h2>
        <ul>
          <li>
            <strong>함께 테스트한 테스터들에게 출시 소식 알리기</strong> — 이미 앱을 아는
            사람들이라 첫 설치·첫 리뷰의 가장 자연스러운 출처입니다.
          </li>
          <li>
            디스콰이엇·커뮤니티·관련 서브레딧에 <strong>제작기</strong>를 쓰세요. 광고 글은
            묻히지만 &ldquo;만들면서 배운 것&rdquo; 글은 읽힙니다.
          </li>
          <li>
            출시 후 2주는 Play Console 의 크래시·ANR 지표를 매일 확인하세요 — 품질 지표가
            나쁘면 노출 자체가 줄어듭니다.
          </li>
        </ul>
        <Tip>
          ⚠️ <strong>리뷰 대가 제공은 Google Play 정책 위반입니다.</strong> 크레딧·기프티콘
          등 무엇이든 별점·리뷰의 조건으로 걸면 앱 삭제·계정 제재 사유가 됩니다. 부탁은
          &ldquo;써보시고 솔직한 의견을 남겨주세요&rdquo;까지만. Tester Match 가 리뷰
          보상 기능을 만들지 않는 이유이기도 합니다.
        </Tip>
      </>
    ),
  },
  {
    slug: "trust-score-and-credits",
    title: "신뢰도 ★ 와 크레딧 — Tester Match 보상 시스템 안내",
    description:
      "닉네임 옆 ★ 숫자는 무엇이고 어떻게 오르나요? 체크인 +1 규칙, 이탈 페널티, 크레딧과 랭킹 보상 계획까지 한 번에 설명합니다.",
    date: "2026-08-14",
    body: (
      <>
        <h2>★ 숫자의 정체</h2>
        <p>
          모든 회원은 <strong>신뢰도 50점</strong>으로 시작합니다. 점수는 게시판·댓글·매칭
          목록 어디서나 닉네임 옆 ★로 보이고, <A href="/stats">활동 랭킹</A>에서 순위로도
          확인할 수 있습니다. 이 점수의 목적은 하나 — <strong>&ldquo;이 사람과 매칭하면
          14일을 완주할 수 있을까?&rdquo;</strong>에 대한 답입니다.
        </p>
        <Img src="/guide/trust-score.svg" alt="신뢰도 증감 규칙 — 매일 체크인 +1, 옵트아웃 −3, 무단 이탈 −10" />
        <h2>왜 이렇게 설계했나</h2>
        <ul>
          <li>
            <strong>체크인에만 가점</strong> — 앱 등록 수나 게시글 수에 점수를 주면 어뷰징
            (자기 앱 양산, 도배)이 생깁니다. 오직 매일의 성실한 참여만 점수가 됩니다.
            상한은 1,000점 — 만점자는 완주 68회 분량의 기록 보유자입니다.
          </li>
          <li>
            <strong>옵트아웃(−3)이 무단 이탈(−10)보다 가벼운 이유</strong> — 포기 자체를
            벌하는 게 아니라 &ldquo;말없이 사라지는 것&rdquo;을 벌합니다. 미리 알려주면
            개발자가 정원을 바로 채울 수 있으니까요.
          </li>
        </ul>
        <h2>크레딧</h2>
        <p>
          크레딧은 <strong>1크레딧 = 1원</strong> 가치의 서비스 내 포인트입니다. 14일 완주
          시 테스터에게 <strong>800크레딧</strong>이 적립되고, 급구(부스트) 같은 유료 기능
          결제에 사용할 수 있습니다.
        </p>
        <h2>랭킹 크레딧 보상 (준비 중)</h2>
        <p>
          성실한 참여가 더 확실히 보상받도록, 활동 랭킹 상위와 완주 실적에 따른 크레딧
          보상을 준비하고 있습니다. <strong>지금 쌓이는 체크인·완주 기록이 모두 반영될
          예정</strong>이니, 시행 전이라도 기록은 손해가 아닙니다.
        </p>
        <Tip>
          🙋 자주 묻는 질문 — <strong>&ldquo;점수가 깎였는데 억울해요&rdquo;</strong>:
          모든 증감은 원장에 기록됩니다. 문의를 주시면 관리자가 이력을 확인하고 잘못된
          감점은 정정해드립니다.
        </Tip>
      </>
    ),
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
