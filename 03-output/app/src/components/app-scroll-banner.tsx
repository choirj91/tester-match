"use client";

type AppItem = { name: string; desc: string };

const ROW1: AppItem[] = [
  { name: "살핌", desc: "식품·화장품 성분표를 사진 한 장으로 분석. AI가 13개 언어로 각 성분의 역할을 설명합니다." },
  { name: "LEVEL UP: REBOOT", desc: "RPG 게임처럼 현실을 레벨업. 퀘스트·스탯·던전으로 자기계발을 게임화하는 앱." },
  { name: "EmotionEye", desc: "카메라를 켜면 바로 시작. 행복·슬픔·분노 등 내 감정을 실시간으로 분석하는 AI 앱." },
  { name: "Blinq", desc: "5가지 가치관 기반 소개팅. 매칭 호환도 % 표시, 직장인·학생 이메일 인증 뱃지." },
  { name: "전:록", desc: "취향에서 시작되는 전시 추천. 설명보다 감각으로, 순위보다 취향으로 전시를 골라냅니다." },
  { name: "어스다이저", desc: "3D 지구본 기반 실시간 재난 알림, 국가별 안전 정보, 여행 플래너를 제공하는 앱." },
  { name: "사주몬", desc: "생년월일시를 입력하면 사주 캐릭터가 탄생. AI가 오늘의 운세와 연애·커리어·건강 운을 분석." },
  { name: "블로그 자동화", desc: "스마트폰 하나로 블로그 기획부터 발행까지 3분. PC 없이 수익형 블로그를 운영하는 앱." },
  { name: "어린이 탐정단", desc: "7~10세 아동 대상 추리 퀴즈 게임. 광고·결제·개인정보 수집 없음. 3개 단서로 범인을 추리." },
  { name: "바스타임", desc: "피곤한 날, 잠 안 오는 밤, 운동 후 뻐근한 날에 맞는 샤워·목욕 루틴을 안내합니다." },
  { name: "3D 파이프 계산기", desc: "현장 실무자를 위한 3D 파이프·배관 계산기. 3D 모델을 돌려보며 계산하는 앱." },
  { name: "Hex Drop", desc: "AI와 대전하는 헥사곤 블록 퍼즐. 14일 테스트 기간 동안 AI의 실력도 올라갑니다." },
  { name: "카세트 플레이어", desc: "레트로 카세트 테이프 감성의 뮤직 플레이어. 스킵할 수 없습니다. 음악에 깊이 빠져드세요." },
  { name: "역번역 학습", desc: "내 외국어 발화를 모국어로 번역 후 3가지 버전으로 역번역해 정확성을 확인하는 학습 앱." },
  { name: "AI 상세페이지", desc: "상품 URL 하나로 전문 상세페이지를 즉시 생성. 쇼핑몰 운영자를 위한 올인원 도구." },
  { name: "세차 날씨", desc: "오늘 세차하기 좋은 날인지 추천해주는 단순하고 명확한 날씨 앱." },
];

const ROW2: AppItem[] = [
  { name: "펫 지니", desc: "사진 한 장으로 반려동물의 눈·피부·치아 등 건강 상태를 체크하는 AI 스캐너 앱." },
  { name: "교대 스케줄러", desc: "교대근무자들을 위한 스케줄링 및 커뮤니티. 같은 근무 패턴의 사람들과 소통합니다." },
  { name: "무음 카메라", desc: "에티켓과 프라이버시를 동시에. 위장 기능과 보안 삭제를 갖춘 스마트 무음 카메라." },
  { name: "중국어 끝판왕", desc: "HSK 1~6급 단어와 사자성어, 관용어까지 풍부한 예문으로 배우는 무료 중국어 학습 앱." },
  { name: "쇼츠 시청관리", desc: "쇼츠·인스타그램 사용을 감지해 하루 시청 시간을 스스로 관리할 수 있게 해주는 앱." },
  { name: "한국사 공부", desc: "한국사 검정 능력 시험을 대비하고 한국사를 재밌게 공부할 수 있는 학습 앱." },
  { name: "QR 로또확인", desc: "QR코드로 1초 만에 로또 당첨 확인. 나만의 로또 사진첩으로 행운을 간직하세요." },
  { name: "주기 알람", desc: "자꾸 잊어버리는 주기적인 일들을 관리. 밀려도 사라지지 않고, 한 날 갱신하면 다시 카운트." },
  { name: "시사경제용어", desc: "좌우 스와이프로 가볍게 배우는 경제 용어 SRS 학습 앱. 기획재정부 자료 기반." },
  { name: "토익스피킹 AI", desc: "토익스피킹 모의고사와 AI 채점 서비스. 실전처럼 연습하고 즉시 피드백을 받습니다." },
  { name: "주식 속보", desc: "실시간 주식 속보와 키워드 알림. 원하는 시간에 코스피·나스닥 요약 정보를 알림으로." },
  { name: "결혼 플래너", desc: "결혼 비용 계산과 일정 관리를 한 앱에서. 복잡한 결혼 준비를 단순하게 정리합니다." },
  { name: "어린이 동화", desc: "부모님 목소리로 녹음한 오디오북. 우리 아이들의 상상력을 키우는 동화 앱." },
  { name: "작물병해진단", desc: "사진으로 작물 병해를 진단하는 앱. 농업 현장에서 빠르게 병해를 확인합니다." },
  { name: "식단·운동 기록", desc: "식단과 운동을 기록하고 주간 레포트로 목표 달성 현황을 시각적 차트로 제공합니다." },
  { name: "바이오 내부자", desc: "미국 바이오 주식 내부자 거래를 추적하는 앱. 기관 동향을 먼저 확인하세요." },
];

function AppCard({ name, desc }: AppItem) {
  return (
    <div
      className="mx-2 flex w-64 shrink-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
      style={{ width: "260px" }}
    >
      <p className="truncate text-sm font-semibold text-neutral-900">{name}</p>
      <p className="mt-1.5 line-clamp-3 flex-1 text-xs leading-relaxed text-neutral-500">{desc}</p>
      <span className="mt-3 inline-block self-start rounded-full bg-trust-50 px-2 py-0.5 text-[10px] font-semibold text-trust-600">
        출시 준비 중
      </span>
    </div>
  );
}

export function AppScrollBanner() {
  return (
    <div className="overflow-hidden py-2 select-none">
      {/* Row 1 — left */}
      <div className="marquee-left flex w-max">
        {[...ROW1, ...ROW1].map((app, i) => (
          <AppCard key={i} {...app} />
        ))}
      </div>
      {/* Row 2 — right */}
      <div className="marquee-right mt-3 flex w-max">
        {[...ROW2, ...ROW2].map((app, i) => (
          <AppCard key={i} {...app} />
        ))}
      </div>
    </div>
  );
}
