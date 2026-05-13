export function KakaoFloatButton() {
  return (
    <div className="group fixed bottom-6 right-6 z-50">
      {/* 호버 툴팁 */}
      <span className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
        카카오 오픈채팅 참여하기
      </span>

      <a
        href="https://open.kakao.com/o/ghJ9350f"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="카카오톡 오픈채팅 참여하기"
        className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-95"
        style={{ backgroundColor: "#FEE500" }}
      >
        {/* KakaoTalk 말풍선 아이콘 */}
        <svg
          width="30"
          height="30"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* 말풍선 몸체 */}
          <ellipse cx="24" cy="22" rx="20" ry="16" fill="#3C1E1E" />
          {/* 말풍선 꼬리 */}
          <path
            d="M16 36 C14 40 10 42 8 44 C12 42 18 40 20 36"
            fill="#3C1E1E"
          />
          {/* KakaoTalk K 심볼 (말풍선 안 점 3개 — 대화 아이콘) */}
          <circle cx="16" cy="22" r="2.5" fill="#FEE500" />
          <circle cx="24" cy="22" r="2.5" fill="#FEE500" />
          <circle cx="32" cy="22" r="2.5" fill="#FEE500" />
        </svg>
      </a>
    </div>
  );
}
